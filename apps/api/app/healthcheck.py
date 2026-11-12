from urllib.request import urlopen

urlopen("http://127.0.0.1:8000/api/health", timeout=3).read()
