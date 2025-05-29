#!/bin/bash
export PATH="/c/Program Files/nodejs:$PATH"
cd "$(dirname "$0")"
npm run build
npm start
