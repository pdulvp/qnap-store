#!/bin/bash

ADD=`git diff repos*.xml | grep -o -P "^\+ .*" | grep -v cachechk | wc -l`
REM=`git diff repos*.xml | grep -o -P "^- .*" | grep -v cachechk | wc -l`

if [ $ADD -ne 0 ] || [ $REM -ne 0 ]; then   
    echo -e "\033[0;32mUpdate store \033[0m"
    git pull bot HEAD
    git config user.email "pdulvp-bot@laposte.net"
    git config user.name "pdulvp-bot"
    git add "repos.xml"
    git add "repos-prereleases.xml"
    git commit -m "Update store"
    git push bot HEAD:master
    git config user.email "pdulvp@laposte.net"
    git config user.name "pdulvp"
else
    echo -e "\033[0;36mNo need to update the store \033[0m"
fi
