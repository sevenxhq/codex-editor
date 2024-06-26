import requests
from lsprotocol.types import DidCloseTextDocumentParams, Range, Position, CompletionList, CompletionItem, CompletionItemKind, TextEdit
from tools.ls_tools import ServerFunctions
from pygls.server import LanguageServer
from typing import List, Any
from time import sleep
import time
import urllib
import threading 

def uri_to_filepath(uri):
    decoded_url = urllib.parse.unquote(uri)
    if decoded_url.startswith('vscode-notebook-cell:/'):
        decoded_url = decoded_url[len('vscode-notebook-cell:/'):]
    if decoded_url.startswith('/'):
        decoded_url = decoded_url[1:]
    return decoded_url.split("#")[0]

class ServableEmbedding:
    def __init__(self, sf: ServerFunctions):
        self.database = None 
        self.sf = sf
        self.last_served: List[Any] = []
        self.time_last_served = time.time()

    def embed_document(self, params, sf):
        path = params[0]['fsPath']
        if ".codex" in path:
            sf.server.show_message(message="Embedding document.")
            response = requests.post(
                'http://localhost:5554/upsert_codex_file',
                json={'db_name': 'drafts', 'path': path}  # Updated 'db_name' to match the Enum in flask_server.py
            )
            if response.status_code == 200:
                sf.server.show_message(message=f"The Codex file '{path}' has been upserted into 'drafts' database")
            else:
                sf.server.show_message(message=f"Failed to upsert the Codex file '{path}'. Error: {response.text}")

    def on_close(self, ls, params: DidCloseTextDocumentParams, fs):
        path = uri_to_filepath(params.text_document.uri)
        self.embed_document([{'fsPath': path}], fs)
        self.sf.server.show_message("Closed file")
    
    
    def embed_completion(self, server: LanguageServer, params, range: Range, sf: ServerFunctions) -> List:
        document_uri = params.text_document.uri
        document = server.workspace.get_document(document_uri)
        line = document.lines[params.position.line].strip()
        if time.time() - self.time_last_served > 2 or not self.last_served:
            self.last_served = line
            self.time_last_served = time.time()
            response = requests.get(
                'http://localhost:5554/search',
                params={'db_name': 'drafts', 'query': line, 'limit': 2}  # Updated 'db_name' to match the Enum in flask_server.py
            )
            if response.status_code == 200:
                results = response.json()
                # Assuming you want to return the results as a list of completion items
                completion_items = [self.create_completion_item(result, range) for result in results]
                return completion_items
            else:
                sf.server.show_message_log(f"Search request failed. Error: {response.text}")
                return []
        else:
            # If the last served line is the same and it has not been 2 seconds, return the last served results
            return self.last_served

    def create_completion_item(self, search_result, range):
        # This is a placeholder function. You need to replace it with actual logic to create a completion item.
        # Assuming 'search_result' is a dictionary with a 'text' field that you want to use for the completion.
        # item =  {
        #     'label': search_result['text'],
        #     'kind': 1,  # Text completion
        #     'documentation': search_result['text'],
        #     'insertText': search_result['text']
        # }
        text = search_result['text']
        return CompletionItem(label=text[:20], text_edit=TextEdit(range=range, new_text=text))

