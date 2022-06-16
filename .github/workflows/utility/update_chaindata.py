import requests
import json
import os
from os import getcwd
from os.path import isfile, isdir, join

rootdir = getcwd()

#Gets a list of all the json file locations for all chains (sorts out unnecessary files)
def jsonlist():
    for chainfolder in os.listdir(rootdir):
        chainjson = os.path.join(chainfolder, "chain.json")
        if os.path.isfile(chainjson):
            return(chainjson)
        
chainjsonlist = jsonlist()

def checkUpdate(jsonlist):
     for chainjson in jsonlist:
         # test case plz remove later
        if chainjson == "osmosis/chainjson":
            current = json.load(open(os.path.join(rootdir, chainjson)))
            URL = current.updatelink
            response = requests.get(URL)
            if sorted(response.codebase) != sorted(current.codebase):
                return True