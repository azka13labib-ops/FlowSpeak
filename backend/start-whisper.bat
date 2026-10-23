@echo off
title Whisper.cpp Server
echo Starting Whisper.cpp server on port 8080 with ggml-tiny.en.bin...
cd /d "%~dp0"
whisper.cpp\prebuilt\Release\whisper-server.exe -m whisper.cpp\ggml-tiny.en.bin --host 127.0.0.1 --port 8080
pause
