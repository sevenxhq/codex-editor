import {
    Disposable,
    Webview,
    WebviewPanel,
    window,
    Uri,
    ViewColumn,
} from "vscode";
import * as vscode from "vscode";
import { Dictionary } from "codex-types";
import { DictionaryPostMessages } from "../../../types";

function getNonce() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export class ScriptureViewerPanel {
    public static currentPanel: ScriptureViewerPanel | undefined;
    private readonly _panel: WebviewPanel;
    private _disposables: Disposable[] = [];

    /**
     * The HelloWorldPanel class private constructor (called only from the render method).
     *
     * @param panel A reference to the webview panel
     * @param extensionUri The URI of the directory containing the extension
     */
    private constructor(panel: WebviewPanel, extensionUri: Uri) {
        this._panel = panel;

        const initAsync = async () => {
            const { data, uri } = await FileHandler.readFile(
                "drafts/project.dictionary",
            );
            // return if no data
            if (!data) {
                return;
            }
            const dictionary: Dictionary = JSON.parse(data);
            console.log("Parsed dictionary:", dictionary);

            // Set the HTML content for the webview panel
            this._panel.webview.html = this._getWebviewContent(
                this._panel.webview,
                extensionUri,
            );

            // Set an event listener to listen for messages passed from the webview context
            this._setWebviewMessageListener(this._panel.webview, uri);

            // Post message to app
            this._panel.webview.postMessage({
                command: "sendData",
                data: dictionary,
            } as DictionaryPostMessages);
        };

        initAsync().catch(console.error);

        // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
        // the panel or when the panel is closed programmatically)
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    /*
     * @param extensionUri The URI of the directory containing the extension.
     */
    public static render(extensionUri: Uri): ScriptureViewerPanel {
        if (ScriptureViewerPanel.currentPanel) {
            // If the webview panel already exists reveal it
            ScriptureViewerPanel.currentPanel._panel.reveal(ViewColumn.One);
        } else {
            // If a webview panel does not already exist create and show a new one
            const panel = window.createWebviewPanel(
                // Panel view type
                // "showDictionaryTable",
                "dictionary-table",
                // Panel title
                "Dictionary Table",
                // The editor column the panel should be displayed in
                ViewColumn.One,
                // Extra panel configurations
                {
                    // Enable JavaScript in the webview
                    enableScripts: true,
                    // Restrict the webview to only load resources from the `out` and `webview-ui/build` directories
                    localResourceRoots: [
                        Uri.joinPath(extensionUri, "out"),
                        Uri.joinPath(
                            extensionUri,
                            "webviews/editable-react-table/dist",
                        ),
                    ],
                },
            );

            ScriptureViewerPanel.currentPanel = new ScriptureViewerPanel(
                panel,
                extensionUri,
            );
        }
        return ScriptureViewerPanel.currentPanel;
    }

    public static createOrShow(
        documentUri: vscode.Uri,
        extensionUri: vscode.Uri,
        webviewPanel?: vscode.WebviewPanel,
    ): ScriptureViewerPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (ScriptureViewerPanel.currentPanel) {
            ScriptureViewerPanel.currentPanel._panel.reveal(column);
            return ScriptureViewerPanel.currentPanel;
        }
        const panel =
            webviewPanel ||
            vscode.window.createWebviewPanel(
                "dictionary-table",
                "Dictionary Table",
                column || vscode.ViewColumn.One,
                { enableScripts: true },
            );
        return new ScriptureViewerPanel(panel, extensionUri);
    }

    /**
     * Cleans up and disposes of webview resources when the webview panel is closed.
     */
    public dispose() {
        ScriptureViewerPanel.currentPanel = undefined;

        // Dispose of the current webview panel
        this._panel.dispose();

        // Dispose of all disposables (i.e. commands) for the current webview panel
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Defines and returns the HTML that should be rendered within the webview panel.
     *
     * @remarks This is also the place where references to the React webview build files
     * are created and inserted into the webview HTML.
     *
     * @param webview A reference to the extension webview
     * @param extensionUri The URI of the directory containing the extension
     * @returns A template string literal containing the HTML that should be
     * rendered within the webview panel
     */
    private _getWebviewContent(webview: Webview, extensionUri: Uri) {
        // The CSS file from the React build output
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                extensionUri,
                "webviews",
                "codex-webviews",
                "dist",
                "ScriptureViewer",
                "index.js",
            ),
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                extensionUri,
                "webviews",
                "codex-webviews",
                "dist",
                "ScriptureViewer",
                "index.css",
            ),
        );

        const nonce = getNonce();

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        // window.initialData = ${JSON.stringify(data)};

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${styleUri}">
          <title>Dictionary Table</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
    }

    /**
     * Sets up an event listener to listen for messages passed from the webview context and
     * executes code based on the message that is recieved.
     *
     * @param webview A reference to the extension webview
     * @param context A reference to the extension context
     */
    private _setWebviewMessageListener(webview: Webview, uri: any) {
        webview.onDidReceiveMessage(
            async (message: DictionaryPostMessages) => {
                const command = message.command;

                switch (command) {
                    case "updateData": {
                        console.log(
                            "The data that would be written to file, pre-encoding:",
                        );
                        const fileData = new TextEncoder().encode(
                            JSON.stringify(message.data),
                        );
                        await vscode.workspace.fs.writeFile(uri, fileData);
                        console.log(
                            "The data that would be written to file, encoded:",
                        );
                        console.log({ fileData });
                        return;
                    }
                    case "confirmRemove": {
                        const confirmed = await window.showInformationMessage(
                            `Do you want to remove ${message.count} items?`,
                            { modal: true },
                            "Yes",
                            "No",
                        );
                        if (confirmed === "Yes") {
                            webview.postMessage({
                                command: "removeConfirmed",
                            } as DictionaryPostMessages);
                        }
                        break;
                    }
                }
            },
            undefined,
            this._disposables,
        );
    }
}

class FileHandler {
    static async readFile(
        filePath: string,
    ): Promise<{ data: string | undefined; uri: vscode.Uri | undefined }> {
        try {
            if (!vscode.workspace.workspaceFolders) {
                throw new Error("No workspace folder found");
            }
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri;
            const fileUri = vscode.Uri.joinPath(workspaceFolder, filePath);
            const fileData = await vscode.workspace.fs.readFile(fileUri);
            const data = new TextDecoder().decode(fileData);
            return { data, uri: fileUri };
        } catch (error) {
            vscode.window.showErrorMessage(`Error reading file: ${filePath}`);
            console.error({ error });
            return { data: undefined, uri: undefined };
        }
    }

    static async writeFile(filePath: string, data: string): Promise<void> {
        try {
            if (!vscode.workspace.workspaceFolders) {
                throw new Error("No workspace folder found");
            }
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri;
            const fileUri = vscode.Uri.joinPath(workspaceFolder, filePath);
            const fileData = new TextEncoder().encode(data);
            await vscode.workspace.fs.writeFile(fileUri, fileData);
        } catch (error) {
            console.error({ error });
            vscode.window.showErrorMessage(
                `Error writing to file: ${filePath}`,
            );
        }
    }
}

export function registerScriptureViewerProvider(
    context: vscode.ExtensionContext,
) {
    const showScriptureViewerCommand = vscode.commands.registerCommand(
        "scriptureViewer.showScriptureViewer",
        async () => {
            ScriptureViewerPanel.render(context.extensionUri);
        },
    );

    // Add command to the extension context
    context.subscriptions.push(showScriptureViewerCommand);
}
