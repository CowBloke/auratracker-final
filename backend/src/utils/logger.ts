import { PrismaClient } from '@prisma/client';

// Log types
export type LogType =
  | 'AUTH'       // Login, logout, register, approval, rejection
  | 'CHAT'       // Messages sent, deleted
  | 'GAME'       // Game completions, scores, rewards
  | 'ECONOMY'    // Transfers, gifts, balance changes
  | 'PARTY'      // Party created, joined, left, disbanded
  | 'SUGGESTION' // Suggestions posted, voted, commented
  | 'MARKETPLACE'// Item purchases, item usage
  | 'ADMIN'      // Admin actions (user edits, item management)
  | 'BAN'        // Bans created, removed
  | 'AURACOIN';  // AuraCoin buy/sell

// Log actions by type
export type AuthAction = 'login' | 'logout' | 'register' | 'login_failed' | 'login_banned';
export type ChatAction = 'message_sent' | 'message_deleted';
export type GameAction = 'game_complete' | 'game_reward' | 'casino_bet' | 'highscore' | 'reward_fallback';
export type EconomyAction = 'transfer' | 'gift_aura' | 'balance_change' | 'quest_reward' | 'pass_reward';
export type PartyAction = 'party_create' | 'party_join' | 'party_leave' | 'party_disband' | 'party_kick' | 'party_invite';
export type SuggestionAction = 'suggestion_create' | 'suggestion_vote' | 'suggestion_comment' | 'suggestion_delete' | 'suggestion_status' | 'suggestion_rating' | 'bug_report';
export type MarketplaceAction =
  | 'item_purchase'
  | 'item_use'
  | 'item_create'
  | 'item_delete'
  | 'listing_create'
  | 'listing_sold'
  | 'listing_cancel';
export type AdminAction = 'user_update' | 'user_delete' | 'user_approve' | 'user_reject' | 'registration_reviews_import' | 'inventory_add' | 'inventory_update' | 'inventory_remove' | 'item_create' | 'item_update' | 'item_delete' | 'item_image_upload' | 'shop_categories_update' | 'chat_clear' | 'stats_delete' | 'badge_create' | 'badge_assign' | 'badge_remove' | 'setting_update' | 'settings_bulk_update' | 'extreme_aura_reset' | 'deploy_trigger' | 'polymarket_event_create' | 'polymarket_event_update' | 'polymarket_event_resolve' | 'polymarket_event_delete' | 'polymarket_suggestion_approve' | 'polymarket_suggestion_reject' | 'gift_template_create' | 'gift_template_update' | 'gift_template_delete' | 'bombparty_prompts_recalculate' | 'update_popup_create' | 'update_popup_update' | 'update_popup_delete' | 'update_popup_image_upload' | 'bug_report_update' | 'bug_report_delete' | 'online_snapshot_create' | 'appeal_reject' | 'username_change' | 'username_change_reject' | 'clan_update' | 'clan_transfer_leadership' | 'clan_delete' | 'warning_create' | 'warning_delete' | 'skill_train' | 'business_create' | 'business_loan_request' | 'business_loan_decision' | 'business_deposit' | 'business_withdraw' | 'business_invest' | 'business_research_start' | 'bank_upgrade_purchase' | 'bank_rate_update' | 'bank_daily_revenue' | 'relationship_create' | 'relationship_reactivate' | 'marriage_proposal' | 'marriage_response' | 'divorce_proposal' | 'divorce_response' | 'relationship_mistress' | 'relationship_cheating_report' | 'relationship_court_case' | 'couple_deposit' | 'couple_withdraw';
export type BanAction = 'ban_create' | 'ban_remove';
export type AuraCoinAction =
  | 'auracoin_buy'
  | 'auracoin_sell';

export type LogAction = AuthAction | ChatAction | GameAction | EconomyAction | PartyAction | SuggestionAction | MarketplaceAction | AdminAction | BanAction | AuraCoinAction;

export interface LogEntry {
  type: LogType;
  action: LogAction;
  userId?: string | null;
  username?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  details?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

let prisma: PrismaClient | null = null;

export const initLogger = (prismaClient: PrismaClient) => {
  prisma = prismaClient;
};

export const createLog = async (entry: LogEntry): Promise<void> => {
  if (!prisma) {
    console.error('Logger not initialized');
    return;
  }

  try {
    await prisma.log.create({
      data: {
        type: entry.type,
        action: entry.action,
        userId: entry.userId ?? null,
        username: entry.username ?? null,
        targetId: entry.targetId ?? null,
        targetName: entry.targetName ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to create log entry:', error);
  }
};

// Convenience functions for common log types
export const logAuth = (action: AuthAction, userId?: string | null, username?: string | null, details?: Record<string, unknown>, ipAddress?: string | null) =>
  createLog({ type: 'AUTH', action, userId, username, details, ipAddress });

export const logChat = (action: ChatAction, userId?: string | null, username?: string | null, details?: Record<string, unknown>) =>
  createLog({ type: 'CHAT', action, userId, username, details });

export const logGame = (action: GameAction, userId?: string | null, username?: string | null, metadata?: Record<string, unknown>) =>
  createLog({ type: 'GAME', action, userId, username, metadata });

export const logEconomy = (action: EconomyAction, userId?: string | null, username?: string | null, targetId?: string | null, targetName?: string | null, metadata?: Record<string, unknown>) =>
  createLog({ type: 'ECONOMY', action, userId, username, targetId, targetName, metadata });

export const logParty = (action: PartyAction, userId?: string | null, username?: string | null, details?: Record<string, unknown>) =>
  createLog({ type: 'PARTY', action, userId, username, details });

export const logSuggestion = (action: SuggestionAction, userId?: string | null, username?: string | null, details?: Record<string, unknown>) =>
  createLog({ type: 'SUGGESTION', action, userId, username, details });

export const logMarketplace = (action: MarketplaceAction, userId?: string | null, username?: string | null, metadata?: Record<string, unknown>) =>
  createLog({ type: 'MARKETPLACE', action, userId, username, metadata });

export const logAdmin = (action: AdminAction, userId?: string | null, username?: string | null, targetId?: string | null, targetName?: string | null, details?: Record<string, unknown>) =>
  createLog({ type: 'ADMIN', action, userId, username, targetId, targetName, details });

export const logBan = (action: BanAction, userId?: string | null, username?: string | null, targetId?: string | null, targetName?: string | null, details?: Record<string, unknown>) =>
  createLog({ type: 'BAN', action, userId, username, targetId, targetName, details });

export const logAuraCoin = (action: AuraCoinAction, userId?: string | null, username?: string | null, metadata?: Record<string, unknown>) =>
  createLog({ type: 'AURACOIN', action, userId, username, metadata });
