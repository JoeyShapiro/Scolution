import path from 'path';
import * as vscode from 'vscode';
import fs from 'fs';
import { TreeItem } from './tree_item'
import { UUID } from 'crypto';

class StorageData {
    readonly version: string = "1.0.0";
    public root: UUID; // better than indexing somehow, and maybe doesnt work
    public tree: { [key: UUID]: TreeItem } = {};

    constructor() {
        const root = new TreeItem(null, 'root', '', ''); // only need to create the root here
        this.tree[root.uuid] = root;
        this.root = root.uuid;
    }
}

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private storagePath: string | undefined;
    private readonly filename: string = 'scolution.json';
    private root: StorageData = new StorageData();

    constructor() {
        const workspaceRoot = vscode.workspace.workspaceFolders;
        if (!workspaceRoot || workspaceRoot.length == 0) return;
        const vscodePath = path.join(workspaceRoot[0].uri.fsPath, '.vscode');
        this.storagePath = path.join(vscodePath, this.filename);

        // Create .vscode directory if it doesn't exist
        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath);
        }

        this.root = this.getData() || new StorageData();

        // clean tree
        for (const [key, data] of Object.entries(this.root.tree)) {
            this.root.tree[key as UUID] = TreeItem.fromAny(data);
        }

        // save whatever we have
        this.saveData(this.root);
    }

    public getData<T>(): T | null {
        try {
            if (!this.storagePath) {
                return null;
            }

            const rawData = fs.readFileSync(this.storagePath, 'utf8');
            return JSON.parse(rawData);
        } catch (error) { // TODO should exist because we do a save first
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
        this.saveData(this.root!);
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        // get children of current element, or root
        const uuid = element?.uuid || this.root.root
        return Promise.resolve(
            Object.values(this.root.tree).filter(value => value.parent_id === uuid)
        )
    }

    tree(): TreeItem | undefined {
        return this.root.tree[this.root.root];
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
                this.add(new TreeItem(
                    parent.uuid,
                    result,
                    result,
                    'filter'
                ));
            }
        } finally {
            // Clean up
            this.setEditing(undefined);
            disposable.dispose();
        }

        this.refresh();
    }

    add(element: TreeItem) {
        this.root.tree[element.uuid] = element;
        this.refresh();
    }

    remove(uuid: UUID) {
        delete this.root.tree[uuid];
        this.refresh();
    }
}
