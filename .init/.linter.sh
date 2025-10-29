#!/bin/bash
cd /home/kavia/workspace/code-generation/image-processing-suite-37224-37234/image_processing_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

