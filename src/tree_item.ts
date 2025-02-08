import { randomUUID, UUID } from 'crypto';
import * as vscode from 'vscode';

export class TreeItem extends vscode.TreeItem {
    public path: string;
    public parent_id?: UUID | null;
    public uuid: UUID = randomUUID(); // cant use id because its special
    public fileType: string;
    public state: vscode.TreeItemCollapsibleState

    constructor(
        parent_id: UUID | null,
        public readonly label: string,
        path: string, // TODO i think it either gets a path or filter
        fileType: string, // 'file', filter
    ) {
        const collapsibleState = fileType == 'filter' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;

        super(label, collapsibleState);
        this.tooltip = `${path}`; // Show label as tooltip
        this.path = path;
        this.contextValue = fileType;

        this.parent_id = parent_id;
        this.fileType = fileType;
        this.state = collapsibleState

        this.resourceUri = vscode.Uri.parse(`scolution:/${path}`);
        if (fileType == 'file') {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(path)],
            };
        } else {
            this.command = {
                command: 'scolution.state',
                title: 'State',
                arguments: [vscode.Uri.file(path)],
            };
        }
    }

    toJSON() {
        return {
            path: this.path,
            parent_id: this.parent_id,
            uuid: this.uuid,
            fileType: this.fileType,
            label: this.label,
            state: this.state,
        }
    }

    static fromJSON(json: string): TreeItem {
        const data = JSON.parse(json);
        let item = new TreeItem(data.parent_id, data.label, data.path, data.fileType);

        item.uuid = data.uuid;
        item.state = data.state;

        return item;
    }

    static fromAny(data: any): TreeItem {
        if (data.parent_id === undefined ||
            data.label === undefined ||
            data.path === undefined ||
            data.fileType === undefined ||
            data.uuid === undefined ||
            data.state === undefined
        ) {
            console.error('failed to parse any:', data);
        }

        let item = new TreeItem(data.parent_id, data.label, data.path, data.fileType);

        item.uuid = data.uuid;
        item.state = data.state;
        item.collapsibleState = item.state;

        return item;
    }
}

enum DecoColors {
    // Basic UI colors
    foreground = 'foreground',
    errorForeground = 'errorForeground',
    descriptionForeground = 'descriptionForeground',
    
    // Git colors (useful for status indicators)
    modified = 'gitDecoration.modifiedResourceForeground',
    conflicting = 'gitDecoration.conflictingResourceForeground',
    staged = 'gitDecoration.stageModifiedResourceForeground'
}

export interface Change {
    readonly uri: vscode.Uri;
    readonly originalUri: vscode.Uri;
    readonly renameUri?: vscode.Uri;
    readonly status: Status;
}

export enum Status {
    INDEX_MODIFIED,
    INDEX_ADDED,
    INDEX_DELETED,
    INDEX_RENAMED,
    INDEX_COPIED,
    MODIFIED,
    DELETED,
    UNTRACKED,
    IGNORED,
    INTENT_TO_ADD
}

// define the decoration provider
export class TreeItemDecorationProvider implements vscode.FileDecorationProvider {
    private gitAPI: any = null;
    private repositories: any[] = [];
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    private shouldDecorate: (uri: vscode.Uri) => Boolean | Promise<Boolean>;

    constructor(shouldDecorate: (uri: vscode.Uri) => Boolean | Promise<Boolean>) {
        this.initializeGit();
        this.shouldDecorate = shouldDecorate;
    }

    // Initialize Git API and set up repositories
    private async initializeGit() {
        let status = "";
        try {
            const extension = vscode.extensions.getExtension('vscode.git');
            if (extension) {
                const gitExtension = await extension.activate();
                this.gitAPI = gitExtension.getAPI(1);
                this.repositories = this.gitAPI.repositories;

                // Set up repository change listeners
                this.gitAPI.onDidOpenRepository((repo: any) => {
                    this.repositories.push(repo);
                    this.setupRepositoryListeners(repo);
                });

                // Set up listeners for existing repositories
                this.repositories.forEach(repo => this.setupRepositoryListeners(repo));
                status = "success";
            } else {
                status = "missing vscode.git";
            }
        } catch (error: any) {
            console.error('Failed to initialize Git API:', error);
            status = error;
        }
    }

    // Set up repository state change listeners
    private setupRepositoryListeners(repository: any) {
        repository.state.onDidChange(async () => {
            // Notify that decorations need to be updated
            const files = await vscode.workspace.findFiles(new vscode.RelativePattern(repository.rootUri, '**/*'));
            files.forEach((uri: vscode.Uri) => {
                if (!this.shouldDecorate(uri)) return;
                this._onDidChangeFileDecorations.fire(vscode.Uri.parse(`scolution:/${uri}`));
            });
        });
    }

    // Required: Event handler for decoration changes
    get onDidChangeFileDecorations(): vscode.Event<vscode.Uri | vscode.Uri[]> {
        return this._onDidChangeFileDecorations.event;
    }

    // Required: Synchronous provider method
    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (uri.scheme !== "scolution") return;

        // If Git API isn't initialized yet, return nothing
        if (!this.gitAPI || !this.repositories.length) {
            return undefined;
        }

        // unwrap scheme
        const file = uri.path.replace('/file:', 'file:');
        uri = vscode.Uri.parse(file);

        try {
            // Find the repository that contains this file
            const repo = this.repositories.find(repo => {
                const repoRoot = repo.rootUri.fsPath;
                return uri.fsPath.startsWith(repoRoot);
            });

            if (!repo) {
                return undefined;
            }

            // Get the file's status from the repository state
            const status = this.getFileStatus(repo, uri);
            if (!status) {
                return undefined;
            }

            return {
                color: new vscode.ThemeColor(DecoColors.modified),
                badge: "M",
                tooltip: "Modified"
            };
        } catch (error) {
            console.error('Error providing file decoration:', error);
            return undefined;
        }
    }

    // Helper method to get file status
    private getFileStatus(repository: any, uri: vscode.Uri): Status | undefined {
        // Check working tree changes
        const workingTreeChanges = repository.state.workingTreeChanges;
        const workingTreeChange = workingTreeChanges.find((change: Change) => 
            change.uri.fsPath === uri.fsPath
        );
        if (workingTreeChange) {
            return workingTreeChange.status;
        }

        // Check staged changes
        const indexChanges = repository.state.indexChanges;
        const indexChange = indexChanges.find((change: Change) => 
            change.uri.fsPath === uri.fsPath
        );
        if (indexChange) {
            return indexChange.status;
        }

        return undefined;
    }

    // Clean up method
    dispose() {
        this._onDidChangeFileDecorations.dispose();
    }
}
