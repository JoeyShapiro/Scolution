import { randomUUID, UUID } from 'crypto';
import * as vscode from 'vscode';

export class TreeItem extends vscode.TreeItem {
    public path: string;
    public parent_id?: UUID | null;
    public uuid: UUID = randomUUID(); // cant use id because its special

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

        // this.iconPath = new vscode.ThemeIcon('python'); // Uses VS Code's built-in icons
        if (fileType == 'file') {
            this.resourceUri = vscode.Uri.parse(path);
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(path)],
            };
        }
    }
}