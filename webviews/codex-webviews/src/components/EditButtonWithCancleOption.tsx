import React from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

const EditButtonWithCancelOption: React.FC<{
    handleEditButtonClick: () => void;
    editModeIsActive: boolean;
}> = ({ handleEditButtonClick, editModeIsActive }) => {
    return (
        <div style={{ display: "flex", gap: "10px" }}>
            {!editModeIsActive ? (
                <VSCodeButton
                    aria-label="Edit"
                    appearance="icon"
                    title="Edit"
                    onClick={handleEditButtonClick}
                    style={{
                        backgroundColor: "var(--vscode-button-background)",
                        color: "var(--vscode-button-foreground)",
                    }}
                >
                    <i className="codicon codicon-edit"></i>
                </VSCodeButton>
            ) : (
                <VSCodeButton
                    aria-label="Cancel Edit"
                    appearance="icon"
                    title="Cancel Edit"
                    onClick={handleEditButtonClick}
                    style={{
                        backgroundColor: "var(--vscode-button-background)",
                        color: "var(--vscode-button-foreground)",
                    }}
                >
                    <i className="codicon codicon-close"></i>
                </VSCodeButton>
            )}
        </div>
    );
};

export default EditButtonWithCancelOption;
