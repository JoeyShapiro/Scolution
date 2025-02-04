import path from 'path';
import * as vscode from 'vscode';
import fs from 'fs';

class StorageData {
    readonly version: string = "1.0.0";
    public tree?: TreeItem;
}

class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private storagePath: string | undefined;
    private readonly filename: string = 'scolution.json';
    private root?: StorageData | null;

    constructor() {
        const workspaceRoot = vscode.workspace.workspaceFolders;
        if (!workspaceRoot || workspaceRoot.length == 0) return;
        const vscodePath = path.join(workspaceRoot[0].uri.fsPath, '.vscode');
        this.storagePath = path.join(vscodePath, this.filename);

        // Create .vscode directory if it doesn't exist
        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath);
        }

        // Create storage file if it doesn't exist
        if (!fs.existsSync(this.storagePath)) {
            this.saveData(new StorageData());
        }

        this.root = this.getData();
        if (this.root) {
            this.root.tree = new TreeItem('root', vscode.TreeItemCollapsibleState.Collapsed, '');
        }
    }

    public getData<T>(): T | null {
        try {
            if (!this.storagePath) {
                return null;
            }

            const rawData = fs.readFileSync(this.storagePath, 'utf8');
            return JSON.parse(rawData); // TODO convert to type
        } catch (error) {
            console.error('Error reading workspace data:', error);
            return null;
        }
    }

    public saveData(data: StorageData): boolean {
        try {
            if (!this.storagePath) {
                return false;
            }

            fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving workspace data:', error);
            return false;
        }
    }

    public watchStorage(callback: () => void) {
        if (!this.storagePath) {
            return;
        }

        // Watch for changes to the storage file
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(
                path.dirname(this.storagePath),
                path.basename(this.storagePath)
            )
        );

        watcher.onDidChange(callback);
        watcher.onDidCreate(callback);
        watcher.onDidDelete(callback);

        return watcher;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (element) {
            return Promise.resolve(element.branches || []);
        } else {
            if (this.root) {
                return Promise.resolve(this.root.tree?.branches || []);
            } else {
                return Promise.resolve([]);
            }
        }
    }

    tree(): TreeItem | undefined {
        return this.root?.tree
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

    async editFilter(parent: TreeItem): Promise<void> {
        // Handle keyboard input
        const disposable = vscode.workspace.onDidChangeTextDocument(async e => {
            if (this.editingItem && e.document.uri.toString() === this.editingItem.item.resourceUri?.toString()) {
                const value = e.document.getText();
                this.setEditing(this.editingItem.item, value);
            }
        });

        try {
            // Handle the result
            const result = await vscode.window.showInputBox({
                value: '',
                valueSelection: [0, 0],
                validateInput: text => {
                    return text.includes('/') ? 'Name cannot contain /' : null;
                }
            });

            if (result) {
                parent.add(new TreeItem(
                    result,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    ''
                ));
            }
        } finally {
            // Clean up
            this.setEditing(undefined);
            disposable.dispose();
        }
    }
}

class TreeItem extends vscode.TreeItem {
	public path: string;
    public branches: TreeItem[] = [];

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		path: string,
		fileType?: string,
    ) {
        super(label, collapsibleState);
        this.tooltip = `${path}`; // Show label as tooltip
		this.path = path;
        this.contextValue = fileType ? 'file' : 'filter';

		// this.iconPath = new vscode.ThemeIcon('python'); // Uses VS Code's built-in icons
		if (fileType) {
			this.resourceUri = vscode.Uri.parse(path);
			this.command = {
				command: 'vscode.open',
				title: 'Open File',
				arguments: [vscode.Uri.file(path)],
			};
		}
    }

    add(element: TreeItem) {
        return this.branches.push(element);
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

    let newFileCommand = vscode.commands.registerCommand('tree-view.newFile', async (uri?: TreeItem) => {
        const parent = uri || lastFocusedElement || treeDataProvider.tree();
        if (!parent) return;

        const folders = vscode.workspace.workspaceFolders
        if (!folders) {
            return Promise.resolve([]);
        }
        console.warn('folders', folders); // TODO warn and error same color

        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            defaultUri: folders[0].uri // always 1, always workspace. i think
            // TODO force in workspace
        });
        if (!files) return;

        for (const file of files) {
            const path = file.path.split('/');
            const name = path[path.length-1].split('.')[0];

            parent.add(new TreeItem(
                name,
                vscode.TreeItemCollapsibleState.None,
                file.fsPath,
                'dummy'
            ));
        }

        treeDataProvider.refresh();
    });
    
    // TODO need to be able to modify tree, then can try
    let newFilterCommand = vscode.commands.registerCommand('tree-view.newFilter', async (uri?: TreeItem) => {
        const parent = uri || lastFocusedElement || treeDataProvider.tree();
        if (!parent) return;

        await treeDataProvider.editFilter(parent);
        treeDataProvider.refresh();
    });

    // Hello World command
    let helloCommand = vscode.commands.registerCommand('scolution.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from your first VS Code extension!');
    });

    context.subscriptions.push(refreshCommand, newFileCommand, newFilterCommand, helloCommand);
}

export function deactivate() {}