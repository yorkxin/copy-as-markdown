from PIL import Image, ImageDraw
from typing import Dict, Optional, Tuple
import pyautogui
import pyperclip


class OCR:
    @staticmethod
    def find_phrase_in_ocr(text_data: Dict, target_phrase: str) -> Tuple[bool, Optional[Dict]]:
        """
        Find a phrase in OCR text data and return its coordinates.

        Args:
            text_data: OCR text data from pytesseract
            target_phrase: The phrase to search for

        Returns:
            Tuple of (found, coordinates) where coordinates is None if not found
        """
        # Combine consecutive words and their coordinates
        combined_text = []
        combined_coords = []
        current_text = []
        current_coords = []

        for i, word in enumerate(text_data['text']):
            if word.strip():  # Only process non-empty words
                current_text.append(word)
                current_coords.append({
                    'left': text_data['left'][i],
                    'top': text_data['top'][i],
                    'width': text_data['width'][i],
                    'height': text_data['height'][i]
                })
            else:
                if current_text:
                    combined_text.append(' '.join(current_text))
                    # Calculate combined coordinates
                    left = min(c['left'] for c in current_coords)
                    top = min(c['top'] for c in current_coords)
                    right = max(c['left'] + c['width'] for c in current_coords)
                    bottom = max(c['top'] + c['height'] for c in current_coords)
                    combined_coords.append({
                        'left': left,
                        'top': top,
                        'width': right - left,
                        'height': bottom - top
                    })
                    current_text = []
                    current_coords = []

        # Process any remaining words
        if current_text:
            combined_text.append(' '.join(current_text))
            left = min(c['left'] for c in current_coords)
            top = min(c['top'] for c in current_coords)
            right = max(c['left'] + c['width'] for c in current_coords)
            bottom = max(c['top'] + c['height'] for c in current_coords)
            combined_coords.append({
                'left': left,
                'top': top,
                'width': right - left,
                'height': bottom - top
            })

        # Search for the phrase
        for i, text in enumerate(combined_text):
            if target_phrase.lower() in text.lower():
                coords = {
                    'x': combined_coords[i]['left'] + combined_coords[i]['width'] // 2,
                    'y': combined_coords[i]['top'] + combined_coords[i]['height'] // 2,
                    'left': combined_coords[i]['left'],
                    'top': combined_coords[i]['top'],
                    'width': combined_coords[i]['width'],
                    'height': combined_coords[i]['height']
                }
                return True, coords

        return False, None

    @staticmethod
    def get_window_bbox(win_pos: Dict, win_size: Dict) -> Tuple[int, int, int, int]:
        """Get the bounding box for the entire window."""
        return (win_pos['x'], win_pos['y'],
                win_pos['x'] + win_size['width'],
                win_pos['y'] + win_size['height'])

    @staticmethod
    def get_submenu_bbox(win_pos: Dict, win_size: Dict, coords: Dict) -> Tuple[int, int, int, int]:
        """Get the bounding box for the submenu area (right side of parent menu)."""
        return (win_pos['x'] + coords['left'] + coords['width'],  # Start from right edge of parent menu
                win_pos['y'],                                     # Top of window
                win_pos['x'] + win_size['width'],                 # Right edge of window
                win_pos['y'] + win_size['height'])                # Bottom of window

    @staticmethod
    def enhance_image_contrast(image: Image.Image) -> Image.Image:
        """Enhance image contrast for better OCR."""
        image = image.convert('L')  # Convert to grayscale
        return image.point(lambda x: 0 if x < 128 else 255, '1')  # Convert to binary image

    @staticmethod
    def save_debug_image(image: Image.Image, filename: str, marker_coords: Optional[Dict] = None):
        """Save an image with optional marker for debugging."""
        if marker_coords:
            debug_img = image.copy()
            draw = ImageDraw.Draw(debug_img)
            draw.ellipse([marker_coords['x']-5, marker_coords['y']-5,
                        marker_coords['x']+5, marker_coords['y']+5], fill='red')
            debug_img.save(f"{filename}_with_marker.png")
        image.save(filename)


class GUI:
    @staticmethod
    def move_and_click(screen_x: int, screen_y: int):
        """Move mouse to coordinates and click."""
        print(f"Moving mouse to screen coordinates: x={screen_x}, y={screen_y}")
        pyautogui.moveTo(screen_x, screen_y, duration=0.2)
        pyautogui.click()


class Clipboard:
    @staticmethod
    def clear():
        pyperclip.copy('')  # Clear clipboard

    @staticmethod
    def read():
        return pyperclip.paste()