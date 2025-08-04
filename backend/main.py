import requests

def get_random_word() -> str:
    try:
        response = requests.get("https://random-word-api.vercel.app/api?words=1&length=5")
        if response.status_code == 200:
            words = response.json()
            if words:
                return words[0]
    except Exception as e:
        logger.error(f"Error fetching word from API: {e}")
    return random.choice(WORD_LIST)