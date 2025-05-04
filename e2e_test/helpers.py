from dataclasses import dataclass
from PIL import Image, ImageDraw
from typing import Dict, Optional, Tuple
import pyautogui
import pyperclip

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

    def click(self, coords: Coords):
        """Click on the coordinates relative to the window."""
        screen_coords = self.screen_coords(coords)
        pyautogui.click(screen_coords.x(), screen_coords.y(), duration=0.2)

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
    def enhance_image_contrast(image: Image.Image) -> Image.Image:
        """Enhance image contrast for better OCR."""
        image = image.convert('L')  # Convert to grayscale
        return image.point(lambda x: 0 if x < 128 else 255, '1')  # Convert to binary image

    @staticmethod
    def save_debug_image(image: Image.Image, filename: str, marker_coords: Optional[Coords] = None):
        """Save an image with optional marker for debugging."""
        if marker_coords:
            debug_img = image.copy()
            draw = ImageDraw.Draw(debug_img)
            draw.ellipse([marker_coords.x()-5, marker_coords.y()-5,
                        marker_coords.x()+5, marker_coords.y()+5], fill='red')
            debug_img.save(f"{filename}_with_marker.png")
        image.save(filename)

class Clipboard:
    @staticmethod
    def clear():
        pyperclip.copy('')  # Clear clipboard

    @staticmethod
    def read():
        return pyperclip.paste()