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

        this.resourceUri = vscode.Uri.parse(path);
        if (fileType == 'file') {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
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