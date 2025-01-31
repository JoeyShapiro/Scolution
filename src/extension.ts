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
    vscode.window.registerTreeDataProvider('tree-view', treeDataProvider);

    // Command to refresh the tree view
    let refreshCommand = vscode.commands.registerCommand('scolution.refreshTree', () => {
        treeDataProvider.refresh();
    });

    // Hello World command
    let helloCommand = vscode.commands.registerCommand('scolution.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from your first VS Code extension!');
    });

    context.subscriptions.push(refreshCommand, helloCommand);
}

export function deactivate() {}