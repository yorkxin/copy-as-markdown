#!/bin/sh
convert ./artworks/icon.png -density 144 -units PixelsPerInch -geometry 128x128 ./src/static/images/icon-128.png
convert ./artworks/icon.png -density 144 -units PixelsPerInch -geometry 48x48 ./src/static/images/icon-48.png
convert ./artworks/icon.png -density 144 -units PixelsPerInch -geometry 16x16 ./src/static/images/icon-16.png
