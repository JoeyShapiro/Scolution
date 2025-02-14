import * as vscode from 'vscode';
import { TreeDataProvider } from './tree_data_provider'
import { TreeItem } from './tree_item'
import { TreeItemDecorationProvider } from './decoration_provider'
import fs from 'fs';
import { vscodePath } from './util';
import path from 'path';

const contextKey = "workspaceHasScolution";

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "scolution" is now active!');

    let treeDataProvider: TreeDataProvider|undefined;
    const init = () => {
        // Update context when files change
        const dotfolder = vscodePath();
        if (!dotfolder) return;
        const fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(dotfolder, 'scolution.json')
        );

        fileWatcher.onDidCreate(() => vscode.commands.executeCommand('setContext', contextKey, true));
        fileWatcher.onDidDelete(() => vscode.commands.executeCommand('setContext', contextKey, false));

        context.subscriptions.push(fileWatcher);

        treeDataProvider = new TreeDataProvider();
        vscode.window.createTreeView('tree-view', { treeDataProvider, showCollapseAll: true }); // registerTreeDataProvider
    };

    const dotfolder = vscodePath();
    if (!dotfolder) return;
    if (fs.existsSync(path.join(dotfolder, "scolution.json"))) {
        vscode.commands.executeCommand('setContext', contextKey, true);
        init();
    }

    const contextInit = vscode.commands.registerCommand('scolution.init', () => init);

    const deco = new TreeItemDecorationProvider((uri: vscode.Uri) => {
        return treeDataProvider?.contains(uri) ?? false;
    });

    const newFile = async (item?: TreeItem) => {
        if (!item || !treeDataProvider) return;

        const folders = vscode.workspace.workspaceFolders
        if (!folders) {
            return;
        }

        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            defaultUri: folders[0].uri, // always 1, always workspace. i think
        });
        if (!files) return;

        for (const file of files) {
            // check they are all in the right folder
            if (!file.fsPath.startsWith(folders[0].uri.fsPath)) {
                vscode.window.showErrorMessage('Please select a file from the current workspace');
                return;
            }

            const path = file.path.split('/');
            const basename = path[path.length-1].split('.');
            const name = basename[0] || path[path.length-1]

            treeDataProvider.add(new TreeItem(
                item.uuid,
                name,
                file.fsPath,
                'file',
            ));
        }

        treeDataProvider.refresh();
    }

    // Command to refresh the tree view
    let refreshCommand = vscode.commands.registerCommand('scolution.refreshTree', () => {
        if (!treeDataProvider) return;
        treeDataProvider.refresh();
    });

    let newFileCommand = vscode.commands.registerCommand('tree-view.newFile', async () => {
        if (!treeDataProvider) return;
        newFile(treeDataProvider.tree());
    });

    let contextNewFileCommand = vscode.commands.registerCommand('tree-view.context.newFile', async (item?: TreeItem) => {
        if (!treeDataProvider) return;
        newFile(item || treeDataProvider.tree());
    });
    
    let newFilterCommand = vscode.commands.registerCommand('tree-view.newFilter', async () => {
        if (!treeDataProvider) return;
        const parent = treeDataProvider.tree();
        if (!parent) return;

        await treeDataProvider.editFilter(parent);
    });

    let contextNewFilterCommand = vscode.commands.registerCommand('tree-view.context.newFilter', async (item?: TreeItem) => {
        if (!treeDataProvider) return;
        const parent = item || treeDataProvider.tree();
        if (!parent) return;

        await treeDataProvider.editFilter(parent);
    });

    let removeCommand = vscode.commands.registerCommand('tree-view.remove', async (item?: TreeItem) => {
        if (!item || !treeDataProvider) return;

        treeDataProvider.remove(item.uuid);
    });

    let dummyCommand = vscode.commands.registerCommand('scolution.state', (item?: TreeItem) => {
        if (!item) return;
    });

    // register the decoration provider
    vscode.window.registerFileDecorationProvider(deco);

    context.subscriptions.push(refreshCommand,
        newFileCommand, newFilterCommand, contextNewFileCommand, contextNewFilterCommand, removeCommand, dummyCommand,
        contextInit
    );
}

export function deactivate() {}
