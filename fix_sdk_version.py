import re
import json
import os

def check_version_format(obj, path, chain_name):
    properties_to_check = ['language', 'ibc', 'sdk', 'cosmwasm']
    version_pattern = re.compile(r"^v?\d+(\.\d+){0,2}$")

    for prop in properties_to_check:
        if prop in obj and "version" in obj[prop]:
            version_value = obj[prop]["version"]
            
            # Check if the version follows the pattern v#.#.# or #.#.#
            if not version_pattern.match(version_value):
                tag_value = obj[prop].get("tag")
                repo_value = obj[prop].get("repo")
                
                print(f'Unusual version format found in {chain_name} at {path}.{prop}.version: {version_value}')
                print(f'  Tag: {tag_value if tag_value else "None"}')
                print(f'  Repo: {repo_value if repo_value else "None"}')

def process_codebase(codebase, base_path, chain_name):
    check_version_format(codebase, base_path, chain_name)

def process_versions(versions, base_path, chain_name):
    for i, version in enumerate(versions):
        check_version_format(version, f"{base_path}[{i}]", chain_name)

def process_file(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
        chain_name = data.get("chain_name", os.path.basename(os.path.dirname(file_path)))

        if "codebase" in data:
            process_codebase(data["codebase"], "codebase", chain_name)

        if "codebase" in data and "versions" in data["codebase"]:
            process_versions(data["codebase"]["versions"], "codebase.versions", chain_name)

# Directory to process
base_dir = '.'

# Walk through all files in the base directory and testnets subdirectory
for root, dirs, files in os.walk(base_dir):
    if '_template' not in root:
        for file in files:
            if file == 'chain.json':
                process_file(os.path.join(root, file))

