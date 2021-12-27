#!/bin/bash

git pull bot HEAD
git config user.email "pdulvp-bot@laposte.net"
git config user.name "pdulvp-bot"
git add "repos.xml"
git add "repos-prereleases.xml"
git commit -m "Update store"
git push bot HEAD:master
git config user.email "pdulvp@laposte.net"
git config user.name "pdulvp"
