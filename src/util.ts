import * as vscode from 'vscode';
import path from 'path';

export function vscodePath(): string|undefined {
    const workspaceRoot = vscode.workspace.workspaceFolders;
    if (!workspaceRoot || workspaceRoot.length == 0) return;
    return path.join(workspaceRoot[0].uri.fsPath, '.vscode');
}
