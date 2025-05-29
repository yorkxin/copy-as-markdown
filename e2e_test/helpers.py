from dataclasses import dataclass
import sys
import time
from PIL import Image, ImageDraw
from typing import Dict, Optional, Tuple
import pyautogui
import pyperclip
from PIL import ImageGrab
import pytesseract
import cv2
import numpy as np

MAIN_MENU_ITEM_TEXT = "Copy as Markdown"

class Coords:
    _x: int
    _y: int

    def __init__(self, x: int, y: int):
        self._x = x
        self._y = y

    def x(self) -> int:
        return self._x

    def y(self) -> int:
        return self._y

@dataclass
class BoundingBox:
    _top: int
    _left: int
    _width: int
    _height: int

    def __init__(self, top: int, left: int, width: int, height: int):
        self._top = top
        self._left = left
        self._width = width
        self._height = height

    def to_tuple(self) -> Tuple[int, int, int, int]:
        """Convert the bounding box to a tuple of (left, top, right, bottom), which is compatible with PIL's BoundingBox."""
        return (self._left, self._top, self._left + self._width, self._top + self._height)

    def top(self) -> int:
        """Get the top of the bounding box."""
        return self._top

    def left(self) -> int:
        """Get the left of the bounding box."""
        return self._left

    def width(self) -> int:
        """Get the width of the bounding box."""
        return self._width

    def height(self) -> int:
        """Get the height of the bounding box."""
        return self._height

    def center(self) -> Coords:
        """Get the center of the bounding box."""
        return Coords(self._left + self._width // 2, self._top + self._height // 2)

    def bottom(self) -> int:
        """Get the bottom of the bounding box."""
        return self._top + self._height

    def right(self) -> int:
        """Get the right of the bounding box."""
        return self._left + self._width

    def combine(self, other: 'BoundingBox') -> 'BoundingBox':
        """Combine two bounding boxes."""
        top = min(self.top(), other.top())
        left = min(self.left(), other.left())
        right = max(self.right(), other.right())
        bottom = max(self.bottom(), other.bottom())
        return BoundingBox(
            top,
            left,
            right - left,
            bottom - top
        )

@dataclass
class Window:
    _bbox: BoundingBox
    _origin: Coords
    
    def __init__(self, top: int, left: int, width: int, height: int):
        self._bbox = BoundingBox(top, left, width, height)
        self._origin = Coords(left, top)

    def bbox(self) -> BoundingBox:
        """Get the bounding box for the entire window."""
        return BoundingBox(self._bbox.top(), self._bbox.left(), self._bbox.width(), self._bbox.height())

    def screen_coords(self, coords: Coords) -> Coords:
        """Convert coordinates relative to the window to screen coordinates."""
        return Coords(self._origin.x() + coords.x(), self._origin.y() + coords.y())

    def click_center(self):
        """Click on the center of the window."""
        self.click(self.bbox().center())

    def find_phrase_with_ocr(self, target_phrase: str) -> Tuple[bool, Optional[BoundingBox]]:
        """Find a phrase in the window using OCR."""

        # Conver the target phrase to a name that can be used for filenames
        filename_token = sanitize_filename(target_phrase)

        # Take screenshot of the full window
        screen = ImageGrab.grab(bbox=self.bbox().to_tuple())
        OCR.save_debug_image(screen, f"ocr_debug_{filename_token}.png")

        # Enhance image contrast (with enlargement)
        scale_factor = 2  # Must match the factor in enhance_image_contrast
        screen_contrast = OCR.enhance_image_contrast(screen, scale_factor)
        OCR.save_debug_image(screen_contrast, f"ocr_debug_{filename_token}_enhanced.png")

        # OCR to find the menu item. Use psm=11 to get the best results for UI.
        text_data = pytesseract.image_to_data(screen_contrast, config='--psm 11', output_type=pytesseract.Output.DICT)

        # Find the menu item
        found, coords_bbox = OCR.find_phrase_in_ocr(text_data, target_phrase)
        
        # If found, scale bbox back to original size
        if found and coords_bbox is not None:
            # scale bbox back to original size
            coords_bbox = BoundingBox(
                top=coords_bbox.top() // scale_factor,
                left=coords_bbox.left() // scale_factor,
                width=coords_bbox.width() // scale_factor,
                height=coords_bbox.height() // scale_factor
            )
            OCR.save_debug_image(screen, f"ocr_debug_{filename_token}_marker.png", coords_bbox)

        return found, coords_bbox

    def find_and_click_menu_item(self, menu_item_text: str, try_main_menu=True) -> bool:
        # Find the menu item
        found, coords_bbox = self.find_phrase_with_ocr(menu_item_text)

        if found:
            self.click(coords_bbox.center())
            return True
        
        if try_main_menu == False:
            raise Exception(f"Menu item '{menu_item_text}' not found")
        
        # try main menu
        found = self.find_and_click_menu_item(MAIN_MENU_ITEM_TEXT, try_main_menu=False)
        if found == False:
            raise Exception(f"Main menu item '{MAIN_MENU_ITEM_TEXT}' not found")
        
        # wait for submenu to appear
        time.sleep(1)

        # try find the menu item in the submenu
        return self.find_and_click_menu_item(menu_item_text, try_main_menu=False)

    def move_to(self, coords: Coords):
        """Move the mouse to the coordinates relative to the window."""
        screen_coords = self.screen_coords(coords)
        pyautogui.moveTo(screen_coords.x(), screen_coords.y(), duration=0.2)

    def click(self, coords: Coords):
        """Click on the coordinates relative to the window."""
        screen_coords = self.screen_coords(coords)
        pyautogui.click(screen_coords.x(), screen_coords.y(), duration=0.2)

    def select_all(self):
        """Select all text in the window."""
        if sys.platform == 'darwin':
            pyautogui.hotkey('command', 'a')
        else:
            pyautogui.hotkey('ctrl', 'a')

    def poll_clipboard_content(self):
        elapsed_time = 0
        # sleep before polling to avoid race condition
        time.sleep(0.5)
        elapsed_time += 0.5

        n=3
        for _ in range(n):
            clipboard_content = Clipboard.read()
            if clipboard_content != '':
                return clipboard_content
            time.sleep(0.1)
            elapsed_time += 0.1
        raise Exception(f"Clipboard was empty after {elapsed_time} seconds.")

class OCR:
    @staticmethod
    def find_phrase_in_ocr(text_data: Dict, target_phrase: str) -> Tuple[bool, Optional[BoundingBox]]:
        """
        Find a phrase in OCR text data and return its coordinates.

        Args:
            text_data: OCR text data from pytesseract
            target_phrase: The phrase to search for

        Returns:
            Tuple of (found, bounding box) where bounding box is None if not found
        """
        # Combine consecutive words and their bounding boxes
        combined_text = []
        combined_bboxes = []
        current_text = []
        current_bbox = None

        for i, word in enumerate(text_data['text']):
            if word.strip():  # Only process non-empty words
                bbox = BoundingBox(text_data['top'][i], text_data['left'][i], text_data['width'][i], text_data['height'][i])
                if current_bbox is None:
                    current_bbox = bbox
                else:
                    current_bbox = current_bbox.combine(bbox)

                current_text.append(word)
            else:
                if current_text:
                    combined_text.append(' '.join(current_text))

                    # calculate combined bbox
                    combined_bboxes.append(current_bbox)
                    current_bbox = None
                    
                    current_text = []


        # Process any remaining words
        if current_text:
            combined_text.append(' '.join(current_text))
            combined_bboxes.append(current_bbox)

        # Search for the phrase
        for i, text in enumerate(combined_text):
            if target_phrase.lower() in text.lower():
                bbox = combined_bboxes[i]
                return True, bbox

        return False, None

    @staticmethod
    def enhance_image_contrast(image: Image.Image, scale_factor: int = 1) -> Image.Image:
        """Enhance image contrast for better OCR using OpenCV adaptive thresholding."""
        # Convert PIL image to numpy array (grayscale)
        image_np = np.array(image.convert('L'))
        # Optionally resize for small text
        image_np = cv2.resize(image_np, (image_np.shape[1]*scale_factor, image_np.shape[0]*scale_factor), interpolation=cv2.INTER_LANCZOS4)
        # Apply adaptive thresholding
        image_np = cv2.adaptiveThreshold(
            image_np, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10
        )
        # Convert back to PIL Image
        return Image.fromarray(image_np)
    
    @staticmethod
    def save_debug_image(image: Image.Image, filename: str, bbox: Optional[BoundingBox] = None):
        """Save an image with optional marker for debugging."""
        if bbox: 
            marker_coords = bbox.center()
            debug_img = image.copy()
            draw = ImageDraw.Draw(debug_img)
            # draw the marker
            draw.ellipse([marker_coords.x()-5, marker_coords.y()-5,
                        marker_coords.x()+5, marker_coords.y()+5], fill='red')
            # draw the box
            draw.rectangle([bbox.left(), bbox.top(), bbox.right(), bbox.bottom()], outline='red', width=2)
            image = debug_img
        image.save(filename)    

class Clipboard:
    @staticmethod
    def clear():
        pyperclip.copy('')  # Clear clipboard

    @staticmethod
    def read():
        return pyperclip.paste()
    
def sanitize_filename(s: str) -> str:
    # Create a translation table that maps invalid characters to underscores
    invalid_chars = '<>:"/\\|?*'  # Windows invalid filename characters
    translation_table = str.maketrans(invalid_chars, '_' * len(invalid_chars))
    
    # Replace invalid characters and convert to lowercase
    return s.translate(translation_table).lower().replace(' ', '_')
