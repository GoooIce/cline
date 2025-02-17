import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler } from "../"
import { ApiHandlerOptions, ModelInfo, openRouterDefaultModelId, openRouterDefaultModelInfo } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { OpenRouterHandler } from "../providers/openrouter"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import OpenAI from "openai"

export class DeepClaudeHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private deepOptions: ApiHandlerOptions
	private claudeOptions: ApiHandlerOptions
	deepseekClient: OpenAI
	claudeClient: OpenRouterHandler

	constructor(options: ApiHandlerOptions) {
		console.log("[DeepClaudeHandler] 初始化, options:", options)
		this.options = options
		if (!this.options.openRouterApiKey) {
			throw new Error("openRouter API Key is required for DeepClaudeHandler")
		}
		this.deepOptions = {
			...options,
			openRouterModelId: "deepseek/deepseek-r1",

			openRouterModelInfo: {
				supportsPromptCache: false,
			},
		}
		this.claudeOptions = {
			...options,
			openRouterModelId: "anthropic/claude-3.5-sonnet",

			openRouterModelInfo: {
				supportsPromptCache: true,
			},
		}

		try {
			this.deepseekClient = new OpenAI({
				baseURL: "https://openrouter.ai/api/v1",
				apiKey: this.options.openRouterApiKey,
				defaultHeaders: {
					"HTTP-Referer": "https://cline.bot", // Optional, for including your app on openrouter.ai rankings.
					"X-Title": "Cline", // Optional. Shows in rankings on openrouter.ai.
				},
			})
			this.claudeClient = new OpenRouterHandler(this.claudeOptions)
			console.log("[DeepClaudeHandler] 成功实例化 deepseekClient 和 claudeClient")
		} catch (err) {
			console.error("[DeepClaudeHandler] 初始化客户端出错:", err)
			throw err
		}
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// console.log("[DeepClaudeHandler] createMessage 调用, systemPrompt:", systemPrompt)
		console.log("[DeepClaudeHandler] 输入消息:", messages)

		try {
			let temperature = 0.6
			let topP = 0.95

			// DeepSeek 建议使用 user role
			const openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])

			// @ts-ignore-next-line
			const deepseekStream = this.deepseekClient.chat.completions.create({
				model: this.deepOptions.openRouterModelId || "deepseek/deepseek-r1",
				max_tokens: 8192,
				temperature: temperature,
				top_p: topP,
				messages: openAiMessages,
				stream: true,
				transforms: ["middle-out"],
				include_reasoning: true,
			})

			let genId: string | undefined
			const reasoningTokens: string[] = []

			// 遍历 deepseekStream 仅采集 reasoning tokens
			for await (const chunk of await deepseekStream) {
				// openrouter 返回错误对象，而不是抛出异常
				if ("error" in chunk) {
					const error = chunk.error as { message?: string; code?: number }
					console.error(`OpenRouter API Error: ${error?.code} - ${error?.message}`)
					throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
				}

				if (!genId && chunk.id) {
					genId = chunk.id
				}

				const delta = chunk.choices[0]?.delta

				// 仅采集 reasoning tokens
				if ("reasoning" in delta && delta.reasoning) {
					reasoningTokens.push(delta.reasoning as string)
				}
			}

			// log reasoning
			console.log("[DeepClaudeHandler] reasoningTokens:", reasoningTokens)

			// Add reasoning as an assistant message and keep original Anthropic format
			const claudeMessages = [
				...messages,
				{ role: "assistant", content: reasoningTokens.join("") } as Anthropic.Messages.MessageParam,
			]
			const claudeStream = this.claudeClient.createMessage(systemPrompt, claudeMessages)
			yield* claudeStream
		} catch (err) {
			console.error("[DeepClaudeHandler] createMessage 内部错误:", err)
			throw err
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.openRouterModelId
		const modelInfo = this.options.openRouterModelInfo
		if (modelId && modelInfo) {
			return { id: modelId, info: modelInfo }
		}
		return { id: openRouterDefaultModelId, info: openRouterDefaultModelInfo }
	}
}
