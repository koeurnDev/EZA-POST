#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
pip3 install -r requirements.txt
