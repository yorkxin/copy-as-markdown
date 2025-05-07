## Dependencies

## macOS

```sh
# OCR Engine
brew install tesseract
```

## Windows

1. Download Python from Microsoft Store
2. Install tesseract from https://github.com/UB-Mannheim/tesseract/wiki
3. Locate the tesseract.exe file
4. Set env var in PowerShell: 
   ```ps
   # When installed for the current user only
   $env:TESSERACT_PATH="C:\Users\<username>\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
   ```


## Installation

```shell
pip install -r requirements.txt
```

### Run Tests

```
pytest
```
