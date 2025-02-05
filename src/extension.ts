import * as vscode from 'vscode';
import { TreeDataProvider } from './tree_data_provider'
import { TreeItem } from './tree_item'

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "scolution" is now active!');

    // Register the tree data provider
    const treeDataProvider = new TreeDataProvider();
    const treeView = vscode.window.createTreeView('tree-view', { treeDataProvider, showCollapseAll: true }); // registerTreeDataProvider

    let lastFocusedElement: TreeItem | undefined;
    treeView.onDidChangeSelection(e => {
        lastFocusedElement = e.selection.length > 0 ? e.selection[0] : undefined;
    });

    // handle opening and closing of filters
    treeView.onDidCollapseElement(e => {
        treeDataProvider.state(e.element.uuid, vscode.TreeItemCollapsibleState.Collapsed);
    });
    treeView.onDidExpandElement(e => {
        treeDataProvider.state(e.element.uuid, vscode.TreeItemCollapsibleState.Expanded);
    });

    // Command to refresh the tree view
    let refreshCommand = vscode.commands.registerCommand('scolution.refreshTree', () => {
        treeDataProvider.refresh();
    });

    let newFileCommand = vscode.commands.registerCommand('tree-view.newFile', async (_uri?: TreeItem) => {
        const parent = lastFocusedElement || treeDataProvider.tree();
        if (!parent) return;

        const folders = vscode.workspace.workspaceFolders
        if (!folders) {
            return;
        }

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

            treeDataProvider.add(new TreeItem(
                parent.uuid,
                name,
                file.fsPath,
                'file',
            ));
        }

        treeDataProvider.refresh();
    });
    
    let newFilterCommand = vscode.commands.registerCommand('tree-view.newFilter', async (uri?: TreeItem) => {
        const parent = uri || lastFocusedElement || treeDataProvider.tree();
        if (!parent) return;

        await treeDataProvider.editFilter(parent);
    });

    let removeCommand = vscode.commands.registerCommand('tree-view.remove', async (uri?: TreeItem) => {
        const item = uri || lastFocusedElement;
        if (!item) return;

        treeDataProvider.remove(item.uuid);
    });

    // Hello World command
    let helloCommand = vscode.commands.registerCommand('scolution.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from your first VS Code extension!');
    });

    context.subscriptions.push(refreshCommand, newFileCommand, newFilterCommand, removeCommand, helloCommand);
}

export function deactivate() {}