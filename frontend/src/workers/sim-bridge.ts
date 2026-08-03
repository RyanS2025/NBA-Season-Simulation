import { v4 as uuid } from 'uuid'
import type {
  SimWorkerRequest,
  SimWorkerResponse,
  SimWorkerResponseEnvelope,
  SimulateGamePayload,
  SimulateGamesBatchPayload,
  SimulateToDatePayload,
  SimulateDeadlineHourPayload,
  EvaluateTradePayload,
  ValidateTradePayload,
  RunDraftPayload,
  RunDraftLotteryPayload,
  RunFreeAgencyPayload,
  RunAllStarWeekendPayload,
  AdvanceOffseasonPayload,
  ComputeCapSheetPayload,
  ComputeAwardsPayload,
  GenerateSchedulePayload,
  PlayerDevelopmentPayload,
  GenerateLeagueActivityPayload,
  CheckRetirementsPayload,
  CheckHofEligibilityPayload,
  GameResult,
  TradeEvaluation,
  TradeValidation,
  DraftResults,
  DraftLotteryResults,
  FreeAgencyResults,
  AllStarResults,
  CapSheet,
  PlayerDevelopmentResult,
  LeagueActivityResults,
  RetirementResults,
  HofResults,
  DeadlineHourResults,
} from '../types'
import type { Game, SeasonAwards } from '../types'

type ProgressCallback = (percent: number, message: string) => void

interface PendingRequest {
  resolve: (value: SimWorkerResponse) => void
  reject: (error: Error) => void
  onProgress?: ProgressCallback
}

export class SimBridge {
  private worker: Worker | null = null
  private pending = new Map<string, PendingRequest>()
  private _initialized = false
  private _initializing = false

  get initialized(): boolean {
    return this._initialized
  }

  get initializing(): boolean {
    return this._initializing
  }

  async init(engineCode: string, onProgress?: ProgressCallback): Promise<void> {
    if (this._initialized) return
    if (this._initializing) {
      throw new Error('Already initializing')
    }

    this._initializing = true

    try {
      this.worker = new Worker(
        new URL('./sim-worker.ts', import.meta.url),
        { type: 'module' }
      )

      this.worker.onmessage = (event: MessageEvent<SimWorkerResponseEnvelope>) => {
        this.handleMessage(event.data)
      }

      this.worker.onerror = (event: ErrorEvent) => {
        for (const [, pending] of this.pending) {
          pending.reject(new Error(event.message))
        }
        this.pending.clear()
      }

      await this.send(
        { type: 'INIT', payload: { engineCode } },
        onProgress
      )

      this._initialized = true
    } finally {
      this._initializing = false
    }
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    this._initialized = false
    this._initializing = false
    for (const [, pending] of this.pending) {
      pending.reject(new Error('Worker terminated'))
    }
    this.pending.clear()
  }

  private handleMessage(envelope: SimWorkerResponseEnvelope): void {
    const { requestId, response } = envelope
    const pending = this.pending.get(requestId)
    if (!pending) return

    if (response.type === 'PROGRESS') {
      pending.onProgress?.(response.payload.percent, response.payload.message)
      return
    }

    this.pending.delete(requestId)

    if (response.type === 'ERROR') {
      pending.reject(new Error(response.payload.message))
    } else {
      pending.resolve(response)
    }
  }

  private send(request: SimWorkerRequest, onProgress?: ProgressCallback): Promise<SimWorkerResponse> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not created'))
    }

    const requestId = uuid()

    return new Promise<SimWorkerResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, onProgress })
      this.worker!.postMessage({ requestId, request })
    })
  }

  private assertReady(): void {
    if (!this._initialized) {
      throw new Error('SimBridge not initialized. Call init() first.')
    }
  }

  async simulateGame(payload: SimulateGamePayload, onProgress?: ProgressCallback): Promise<GameResult> {
    this.assertReady()
    const res = await this.send({ type: 'SIMULATE_GAME', payload }, onProgress)
    return (res as { type: 'GAME_RESULT'; payload: GameResult }).payload
  }

  async simulateGamesBatch(payload: SimulateGamesBatchPayload, onProgress?: ProgressCallback): Promise<GameResult[]> {
    this.assertReady()
    const res = await this.send({ type: 'SIMULATE_GAMES_BATCH', payload }, onProgress)
    return (res as { type: 'GAMES_BATCH_RESULT'; payload: GameResult[] }).payload
  }

  async simulateToDate(payload: SimulateToDatePayload, onProgress?: ProgressCallback): Promise<GameResult[]> {
    this.assertReady()
    const res = await this.send({ type: 'SIMULATE_TO_DATE', payload }, onProgress)
    return (res as { type: 'GAMES_BATCH_RESULT'; payload: GameResult[] }).payload
  }

  async simulateDeadlineHour(payload: SimulateDeadlineHourPayload, onProgress?: ProgressCallback): Promise<DeadlineHourResults> {
    this.assertReady()
    const res = await this.send({ type: 'SIMULATE_DEADLINE_HOUR', payload }, onProgress)
    return (res as { type: 'DEADLINE_HOUR_RESULTS'; payload: DeadlineHourResults }).payload
  }

  async evaluateTrade(payload: EvaluateTradePayload): Promise<TradeEvaluation> {
    this.assertReady()
    const res = await this.send({ type: 'EVALUATE_TRADE', payload })
    return (res as { type: 'TRADE_EVALUATION'; payload: TradeEvaluation }).payload
  }

  async validateTrade(payload: ValidateTradePayload): Promise<TradeValidation> {
    this.assertReady()
    const res = await this.send({ type: 'VALIDATE_TRADE', payload })
    return (res as { type: 'TRADE_VALIDATION'; payload: TradeValidation }).payload
  }

  async runDraft(payload: RunDraftPayload, onProgress?: ProgressCallback): Promise<DraftResults> {
    this.assertReady()
    const res = await this.send({ type: 'RUN_DRAFT', payload }, onProgress)
    return (res as { type: 'DRAFT_RESULTS'; payload: DraftResults }).payload
  }

  async runDraftLottery(payload: RunDraftLotteryPayload): Promise<DraftLotteryResults> {
    this.assertReady()
    const res = await this.send({ type: 'RUN_DRAFT_LOTTERY', payload })
    return (res as { type: 'DRAFT_LOTTERY_RESULTS'; payload: DraftLotteryResults }).payload
  }

  async runFreeAgency(payload: RunFreeAgencyPayload, onProgress?: ProgressCallback): Promise<FreeAgencyResults> {
    this.assertReady()
    const res = await this.send({ type: 'RUN_FREE_AGENCY', payload }, onProgress)
    return (res as { type: 'FREE_AGENCY_RESULTS'; payload: FreeAgencyResults }).payload
  }

  async runAllStarWeekend(payload: RunAllStarWeekendPayload, onProgress?: ProgressCallback): Promise<AllStarResults> {
    this.assertReady()
    const res = await this.send({ type: 'RUN_ALLSTAR_WEEKEND', payload }, onProgress)
    return (res as { type: 'ALLSTAR_RESULTS'; payload: AllStarResults }).payload
  }

  async advanceOffseason(payload: AdvanceOffseasonPayload, onProgress?: ProgressCallback): Promise<SimWorkerResponse> {
    this.assertReady()
    return this.send({ type: 'ADVANCE_OFFSEASON', payload }, onProgress)
  }

  async computeCapSheet(payload: ComputeCapSheetPayload): Promise<CapSheet> {
    this.assertReady()
    const res = await this.send({ type: 'COMPUTE_CAP_SHEET', payload })
    return (res as unknown as { type: 'CAP_SHEET'; payload: CapSheet }).payload
  }

  async computeAwards(payload: ComputeAwardsPayload): Promise<SeasonAwards> {
    this.assertReady()
    const res = await this.send({ type: 'COMPUTE_AWARDS', payload })
    return (res as { type: 'AWARDS'; payload: SeasonAwards }).payload
  }

  async generateSchedule(payload: GenerateSchedulePayload): Promise<Game[]> {
    this.assertReady()
    const res = await this.send({ type: 'GENERATE_SCHEDULE', payload })
    return (res as { type: 'SCHEDULE'; payload: Game[] }).payload
  }

  async playerDevelopment(payload: PlayerDevelopmentPayload): Promise<PlayerDevelopmentResult[]> {
    this.assertReady()
    const res = await this.send({ type: 'PLAYER_DEVELOPMENT', payload })
    return (res as { type: 'DEVELOPMENT_RESULTS'; payload: PlayerDevelopmentResult[] }).payload
  }

  async generateLeagueActivity(payload: GenerateLeagueActivityPayload): Promise<LeagueActivityResults> {
    this.assertReady()
    const res = await this.send({ type: 'GENERATE_LEAGUE_ACTIVITY', payload })
    return (res as { type: 'LEAGUE_ACTIVITY_RESULTS'; payload: LeagueActivityResults }).payload
  }

  async checkRetirements(payload: CheckRetirementsPayload): Promise<RetirementResults> {
    this.assertReady()
    const res = await this.send({ type: 'CHECK_RETIREMENTS', payload })
    return (res as { type: 'RETIREMENT_RESULTS'; payload: RetirementResults }).payload
  }

  async checkHofEligibility(payload: CheckHofEligibilityPayload): Promise<HofResults> {
    this.assertReady()
    const res = await this.send({ type: 'CHECK_HOF_ELIGIBILITY', payload })
    return (res as { type: 'HOF_RESULTS'; payload: HofResults }).payload
  }
}
