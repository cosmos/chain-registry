import json
import urllib.request
import os
from os import getcwd

rootdir = getcwd()

checkSlip173 = 1
slipWebsites = {}
slipMainnetPrefixes = {}
slipTestnetPrefixes = {}

def readSLIP173():
    slip173URL = "https://raw.githubusercontent.com/satoshilabs/slips/master/slip-0173.md"
    lines = []
    for line in urllib.request.urlopen(slip173URL):
      line = line.decode('utf-8')
      if (len(line) > 2):
        if (line[0] == "|" and line[2] == "["):
          lines.append(line)
    if lines:
      for line in lines:
        pretty = line[3:line.find("]")]
        website = line[line.find("(")+1:line.find(")")]
        slipWebsites[pretty] = website
        secondPipe = line.find("|", 1)
        thirdPipe = line.find("|", secondPipe + 1)
        mainnetArea = line[secondPipe:thirdPipe]
        firstQuote = mainnetArea.find("`")
        if(firstQuote > 0):
          secondQuote = mainnetArea.find("`", firstQuote + 1)
          if(secondQuote > 0):
            mainnetPrefix = mainnetArea[firstQuote + 1:secondQuote]
            slipMainnetPrefixes[pretty] = mainnetPrefix
          else:
            print("Mainnet Bech32 Prefix undefined - missing second quote")
        else:
          print("Mainnet Bech32 Prefix undefined")
        fourthPipe = line.find("|", thirdPipe + 1)
        testnetArea = line[thirdPipe:fourthPipe]
        firstQuote = testnetArea.find("`")
        if(firstQuote > 0):
          secondQuote = testnetArea.find("`", firstQuote + 1)
          if(secondQuote > 0):
            testnetPrefix = testnetArea[firstQuote + 1:testnetArea.find("`", firstQuote + 1)]
            slipTestnetPrefixes[pretty] = testnetPrefix
          else:
            print("Mainnet Bech32 Prefix undefined - missing second quote")
    else:
      raise Exception("no SLIP-0173 entries recorded")

checkSlip44 = 1
slipCoinTypesByNum = {}
slipCoinTypesByName = {}
slip44Websites = {}

def readSLIP44():
    slip44URL = "https://raw.githubusercontent.com/satoshilabs/slips/master/slip-0044.md"
    lines = []
    for line in urllib.request.urlopen(slip44URL):
      line = line.decode('utf-8')
      if(len(line) > 6):
        if(line[0] != "-" and line[0] != "C" and (line[5] == "|" or line[6] == "|" or line[7] == "|" or line[8] == "|" or line[9] == "|" or line[10] == "|" or line[11] == "|")):
          lines.append(line)
    if lines:
      for line in lines:
        coinNumber = int(line[0:line.find(" ")])
        if(line.find("[") > 0):
          pretty = line[line.find("[")+1:line.find("]")]
          website = line[line.find("(")+1:line.find(")")]
          slip44Websites[pretty] = website
        else:
          firstPipe = line.find("|")
          secondPipe = line.find("|", firstPipe + 1)
          thirdPipe = line.find("|", secondPipe + 1)
          pretty = line[thirdPipe+2:len(line)-1]
        slipCoinTypesByNum[coinNumber] = pretty
        slipCoinTypesByName[pretty] = coinNumber
    else:
      raise Exception("no SLIP-0044 entries recorded")

# -----FOR EACH CHAIN-----
def checkChains():
    for chainfolder in os.listdir(rootdir):
        chainjson = os.path.join(chainfolder, "chain.json")
        print(chainjson + "  - " + str(os.path.exists(chainjson)))
        if not os.path.exists(chainjson):
            continue
        chainSchema = json.load(open(os.path.join(rootdir, chainjson)))
        assetlistjson = os.path.join(chainfolder, "assetlist.json")
        print(assetlistjson + "  - " + str(os.path.exists(assetlistjson)))
        if not os.path.exists(assetlistjson):
            continue
        assetlistSchema = json.load(open(os.path.join(rootdir, assetlistjson)))
        bases = []
        if "assets" in assetlistSchema:
          if assetlistSchema["assets"]:
            for asset in assetlistSchema["assets"]:
              assetDenoms = []
              if "denom_units" in asset:
                if asset["denom_units"]:
                  for unit in asset["denom_units"]:
                    if "denom" in unit:
                      assetDenoms.append(unit["denom"])
                    else:
                      raise Exception("unit doesn't contain 'denom' string")
                    if "aliases" in unit:
                      for alias in unit["aliases"]:
                        assetDenoms.append(alias)
                else:
                  raise Exception("'denon_units' array doesn't contain any units")
              else:
                raise Exception("asset doesn't contain 'denom_units' array")
              if "base" in asset:
                if asset["base"] in assetDenoms:
                  bases.append(asset["base"])
                else:
                  raise Exception("base not in denom_units")
              else:
                raise Exception("asset doesn't contain 'base' string")
              if "display" in asset:
                if asset["display"] not in assetDenoms:
                  raise Exception("display " + asset["display"] + " not in denom_units")
              else:
                raise Exception("asset doesn't contain 'display' string")
          else:
            raise Exception("'assets' array doesn't contain any tokens")
        else:
          raise Exception("assetlist schema doesn't contain 'assets' array")
        if "fees" in chainSchema:
          if "fee_tokens" in chainSchema["fees"]:
            if chainSchema["fees"]["fee_tokens"]:
              for token in chainSchema["fees"]["fee_tokens"]:
                if "denom" in token:
                  if token["denom"] not in bases:
                    raise Exception(token["denom"] + " is not in bases")
                else:
                  raise Exception("token doesn't contain 'denom' string")
            else:
              raise Exception("'fee_tokens' array doesn't contain any tokens")
          else:
            raise Exception("'fees' object doesn't contain 'fee_tokens' array")
        else:
          print("[OPTIONAL - Keplr Compliance] chain schema doesn't contain 'fees' object")
        if "staking" in chainSchema:
          if "staking_tokens" in chainSchema["staking"]:
            if chainSchema["staking"]["staking_tokens"]:
              for token in chainSchema["staking"]["staking_tokens"]:
                if "denom" in token:
                  if token["denom"] not in bases:
                    raise Exception(token["denom"] + " is not in bases")
                else:
                  raise Exception("token doesn't contain 'denom' string")
            else:
              raise Exception("'staking_tokens' array doesn't contain any tokens")
          else:
            raise Exception("'fees' object doesn't contain 'staking_tokens' array")
        else:
          print("[OPTIONAL - Keplr Compliance] chain schema doesn't contain 'staking' object")
        if "network_type" in chainSchema:
          networkType = chainSchema["network_type"]
          if networkType == "mainnet":
            slipPrefixes = slipMainnetPrefixes
          elif networkType == "testnet":
            slipPrefixes = slipTestnetPrefixes
          else:
            raise Exception("network type unknown (not Mainnet nor Testnet)")
        else:
          raise Exception("chain schema doesn't contain 'network_type'")
        if "pretty_name" in chainSchema:
          prettyName = chainSchema["pretty_name"]
          if checkSlip173:
            if "bech32_prefix" in chainSchema:
              if prettyName == "Terra Classic" or prettyName == "Terra 2.0":
                  prettyName = "Terra"
              if prettyName in slipWebsites:
                if prettyName in slipPrefixes:
                  if chainSchema["bech32_prefix"] != slipPrefixes[prettyName]:
                    raise Exception("chain.json bech32 prefix " + chainSchema["bech32_prefix"] + " does not match SLIP-0173 prefix " + slipPrefixes[prettyName])
                else:
                  raise Exception(prettyName + " SLIP-0173 registeration does not have prefix")
              else:
                raise Exception(prettyName + "  not registered to SLIP-0173")
            else:
              raise Exception(prettyName + " missing 'bech32_prefix'")
          if checkSlip44:
            if "slip44" in chainSchema:
              coinType = chainSchema["slip44"]
              if prettyName in slipCoinTypesByName:
                if coinType != slipCoinTypesByName[prettyName]:
                  raise Exception("Chain schema Coin Type " + str(coinType) + " does not equal slip44 registration " + str(slipCoinTypesByName[prettyName]))
              else:
                if coinType in slipCoinTypesByNum:
                  if slipCoinTypesByNum[coinType] == "":
                    raise Exception("Coin Type " + str(coinType) + " is unregistered in SLIP44")
                else:
                  raise Exception("Coin Type " + str(coinType) + " is unreserved in SLIP44")
            else:
              print("[OPTIONAL - Keplr Compliance] chain schema doesn't contain 'slip44' string")
        else:
          raise Exception("chainSchema does not contain 'pretty_name'")
    print("Done")
    
def runAll():
  if checkSlip173:
    readSLIP173()
  if checkSlip44:
    readSLIP44()
  checkChains()
