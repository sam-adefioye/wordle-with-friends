import json
import os

# Load words from JSON file
def load_words():
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Construct the path to words.json relative to this script
    words_file_path = os.path.join(script_dir, 'words.json')
    
    with open(words_file_path, 'r') as f:
        words_dict = json.load(f)
    # Filter for 5-letter words only
    return [word for word in words_dict.keys()] 