import json

# Load words from JSON file
def load_words():
    with open('backend/words.json', 'r') as f:
        words_dict = json.load(f)
    # Filter for 5-letter words only
    return [word for word in words_dict.keys()] 