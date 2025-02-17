import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import Fuse from "fuse.js"
import React, { KeyboardEvent, memo, useEffect, useMemo, useRef, useState } from "react"
import { useRemark } from "react-remark"
import styled from "styled-components"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import { highlight } from "../history/HistoryView"
import ModelProviderSelector from "./ModelProviderSelector"

const DeepClaudeView: React.FC = () => {
    const state = useExtensionState()
    
    return (
        <div>
            <h2>DeepClaude providers</h2>

            <div>{state.apiConfiguration?.apiModelId}</div>
            <div>{state.apiConfiguration?.apiProvider}</div>
            <div>{state.apiConfiguration?.deepClaude?.modelProviders.length}</div>
            <div>{state.apiConfiguration?.deepClaude?.searchProviders?.length}</div>

            <button onClick={
                () => state.setApiConfiguration({
                    apiModelId: "test",
                    apiProvider: "deepclaude",
                    deepClaude: {
                        modelProviders: [
                            {	
                            	// modelId: string,
                                // providerId: string,
                                // promptTemplate: string,
                                // priority: number, // 优先级越小越早调用
                                // applicationFields: string[], // 默认为 content
                                // isEnabled: boolean, // 是否启用默认为 true
                                modelId: "test",
                                providerId: "test",
                                promptTemplate: "test",
                                priority: 1,
                                applicationFields: ["content"],
                                isEnabled: true
                            }
                        ],
                        searchProviders: [
                            
                        ]
                        
                    }
                })
            }>添加模型</button>
            
        </div>
    )
}

export default DeepClaudeView