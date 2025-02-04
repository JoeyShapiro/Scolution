import path from 'path';
import * as vscode from 'vscode';

class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (element) {
			const folders = vscode.workspace.workspaceFolders
			if (!folders) {
				return Promise.resolve([]);
			}

			const root = folders[0].uri.fsPath;

            // Return children for the given element
            return Promise.resolve([
                new TreeItem('extension', vscode.TreeItemCollapsibleState.None, `${root}/src/extension.ts`, '.ts'),
                new TreeItem('icon', vscode.TreeItemCollapsibleState.None, `${root}/media/icon.svg`, '.svg'),
				new TreeItem('conduit', vscode.TreeItemCollapsibleState.None, `${root}/conduit.go`, '.go')
            ]);
        } else {
            // Return root elements
            return Promise.resolve([
                new TreeItem('Item 1', vscode.TreeItemCollapsibleState.Collapsed, ''),
                new TreeItem('Item 2', vscode.TreeItemCollapsibleState.Collapsed, '')
            ]);
        }
    }

    // Track the item being edited
    private editingItem?: { item: TreeItem; value: string };

    setEditing(item: TreeItem | undefined, value = '') {
        if (item) {
            this.editingItem = { item, value };
        } else {
            this.editingItem = undefined;
        }
        this._onDidChangeTreeData.fire(item);
    }

    async startRename(element: TreeItem): Promise<void> {
        this.setEditing(element);
        
        // Create a text editor decoration type for the inline input
        const decoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: 'Enter to confirm, Escape to cancel',
                color: new vscode.ThemeColor('descriptionForeground')
            }
        });

        // Handle keyboard input
        const disposable = vscode.workspace.onDidChangeTextDocument(async e => {
            if (this.editingItem && e.document.uri.toString() === this.editingItem.item.resourceUri?.toString()) {
                const value = e.document.getText();
                this.setEditing(this.editingItem.item, value);
            }
        });

        try {
            // Show the inline input box
            const editor = await vscode.window.showTextDocument(element.resourceUri!, {
                preview: false,
                preserveFocus: true
            });

            // Apply the decoration
            editor.setDecorations(decoration, [{
                range: new vscode.Range(0, 0, 0, 0)
            }]);

            // Handle the result
            const result = await vscode.window.showInputBox({
                value: element.label,
                valueSelection: [0, element.label.length],
                validateInput: text => {
                    return text.includes('/') ? 'Name cannot contain /' : null;
                }
            });

            if (result) {
                const newPath = path.join(path.dirname(element.path!), result);
                await vscode.workspace.fs.rename(element.resourceUri!, vscode.Uri.file(newPath), { overwrite: false });
            }
        } finally {
            // Clean up
            this.setEditing(undefined);
            disposable.dispose();
            decoration.dispose();
        }
    }
}

class TreeItem extends vscode.TreeItem {
	public path: string;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		path: string,
		fileType?: string,
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`; // Show label as tooltip
		this.path = path;
        this.contextValue = fileType ? 'file' : 'filter';

		// this.iconPath = new vscode.ThemeIcon('python'); // Uses VS Code's built-in icons
		if (fileType) {
			this.resourceUri = vscode.Uri.parse(`file:///fake/path/file.${fileType}`);
			this.command = {
				command: 'vscode.open',
				title: 'Open File',
				arguments: [vscode.Uri.file(path)],
			};
		}
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "scolution" is now active!');

    // Register the tree data provider
    const treeDataProvider = new TreeDataProvider();
    const treeView = vscode.window.createTreeView('tree-view', { treeDataProvider, showCollapseAll: true }); // registerTreeDataProvider

    let lastFocusedElement: TreeItem | undefined;
    treeView.onDidChangeSelection(e => {
        if (e.selection.length > 0) {
            lastFocusedElement = e.selection[0];
        }
    });

    // Command to refresh the tree view
    let refreshCommand = vscode.commands.registerCommand('scolution.refreshTree', () => {
        treeDataProvider.refresh();
    });

    let newFileCommand = vscode.commands.registerCommand('tree-view.newFile', async (uri?: vscode.Uri) => {
        const targetUri = uri || (vscode.workspace.workspaceFolders?.[0].uri);
        if (targetUri) {
            // await createNewFile(targetUri);
            console.log(targetUri);
            treeDataProvider.refresh();
        }
    });
    
    // TODO need to be able to modify tree, then can try
    let newFilterCommand = vscode.commands.registerCommand('tree-view.newFilter', async (uri?: vscode.Uri) => {
        const parentUri = lastFocusedElement;
        if (!parentUri) return;

        // Create a temporary TreeItem for the new folder
        const tempItem = new TreeItem(
            'New Folder',
            vscode.TreeItemCollapsibleState.Collapsed,
            ''
        );

        await treeDataProvider.startRename(tempItem);
        treeDataProvider.refresh();
    });

    // Hello World command
    let helloCommand = vscode.commands.registerCommand('scolution.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from your first VS Code extension!');
    });

    context.subscriptions.push(refreshCommand, newFileCommand, newFilterCommand, helloCommand);
}

export function deactivate() {}