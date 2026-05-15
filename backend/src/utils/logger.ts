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
  | 'AURACOIN'   // AuraCoin buy/sell
  | 'BUSINESS'   // Business, bank, formation, and relationship actions
  | 'FORUM';     // Forum subreddits, posts, comments

// Log actions by type
export type AuthAction = 'login' | 'logout' | 'register' | 'login_failed' | 'login_banned';
export type ChatAction = 'message_sent' | 'message_deleted';
export type GameAction = 'game_complete' | 'game_reward' | 'casino_bet' | 'casino_start' | 'highscore' | 'reward_fallback' | 'horse_race_place_bet' | 'horse_race_cancel_bet' | 'horse_race_settle_bet' | 'horse_race_create_stable' | 'horse_race_buy_horse' | 'horse_race_train' | 'horse_race_register' | 'horse_race_dope' | 'horse_race_breed';
export type EconomyAction = 'transfer' | 'gift_aura' | 'balance_change' | 'quest_reward' | 'pass_reward';
export type PartyAction = 'party_create' | 'party_join' | 'party_leave' | 'party_disband' | 'party_kick' | 'party_invite' | 'party_update';
export type SuggestionAction = 'suggestion_create' | 'suggestion_vote' | 'suggestion_comment' | 'suggestion_delete' | 'suggestion_status' | 'suggestion_rating' | 'bug_report';
export type MarketplaceAction =
  | 'item_purchase'
  | 'item_use'
  | 'item_create'
  | 'item_import'
  | 'item_delete'
  | 'listing_create'
  | 'listing_sold'
  | 'listing_cancel';
export type AdminAction = 'user_update' | 'user_delete' | 'user_approve' | 'user_reject' | 'registration_reviews_import' | 'inventory_add' | 'inventory_update' | 'inventory_remove' | 'item_create' | 'item_import' | 'item_update' | 'item_delete' | 'item_image_upload' | 'shop_categories_update' | 'chat_clear' | 'chat_export' | 'stats_delete' | 'badge_create' | 'badge_assign' | 'badge_remove' | 'badge_equip' | 'setting_update' | 'settings_bulk_update' | 'tax_brackets_update' | 'tax_manual_run' | 'daily_tax_run' | 'extreme_aura_reset' | 'deploy_trigger' | 'polymarket_event_create' | 'polymarket_event_update' | 'polymarket_event_resolve' | 'polymarket_event_delete' | 'polymarket_suggestion_approve' | 'polymarket_suggestion_reject' | 'gift_template_create' | 'gift_template_update' | 'gift_template_delete' | 'bombparty_prompts_recalculate' | 'update_popup_create' | 'update_popup_update' | 'update_popup_delete' | 'update_popup_image_upload' | 'bug_report_update' | 'bug_report_delete' | 'online_snapshot_create' | 'game_limits_bulk_update' | 'appeal_reject' | 'username_change' | 'username_change_reject' | 'user_follow' | 'user_unfollow' | 'name_change_request' | 'clan_create' | 'clan_join' | 'clan_leave' | 'clan_kick' | 'clan_promote' | 'clan_demote' | 'clan_update' | 'clan_transfer_leadership' | 'clan_delete' | 'clan_war_declare' | 'clan_war_attack' | 'clan_war_fortify' | 'clan_war_game' | 'clan_bank_deposit' | 'warning_create' | 'warning_delete' | 'skill_train' | 'business_create' | 'business_delete' | 'business_invite' | 'business_loan_request' | 'business_loan_decision' | 'business_loan_repay' | 'business_deposit' | 'business_withdraw' | 'business_invest' | 'business_transfer' | 'business_transfer_fee_update' | 'business_buyout_offer_create' | 'business_buyout_offer_respond' | 'business_buyout_offer_cancel' | 'business_share_proposal_create' | 'business_share_proposal_review' | 'business_share_proposal_cancel' | 'business_research_start' | 'business_product_deploy' | 'business_collect' | 'business_sale' | 'business_profile_update' | 'business_invitation_respond' | 'business_member_sack' | 'business_member_salary_update' | 'business_formation_product_buy' | 'business_rate' | 'bank_upgrade_purchase' | 'bank_rate_update' | 'bank_daily_revenue' | 'bank_account_open' | 'bank_account_deposit' | 'bank_account_withdraw' | 'formation_update' | 'formation_purchase' | 'formation_product_create' | 'formation_product_update' | 'formation_product_delete' | 'formation_product_review' | 'ad_approve' | 'ad_reject' | 'ad_delete_forever' | 'relationship_create' | 'relationship_forget' | 'relationship_reactivate' | 'marriage_proposal' | 'marriage_response' | 'divorce_proposal' | 'divorce_response' | 'relationship_force_divorce' | 'relationship_mistress' | 'relationship_cheating_report' | 'relationship_court_case' | 'couple_deposit' | 'couple_withdraw';

export type BanAction = 'ban_create' | 'ban_remove';
export type AuraCoinAction =
  | 'auracoin_buy'
  | 'auracoin_sell'
  | 'block_mined'
  | 'gpu_purchase';
export type ForumAction =
  | 'subreddit_create'
  | 'subreddit_join'
  | 'subreddit_leave'
  | 'forum_post_create'
  | 'forum_post_delete'
  | 'forum_comment_create'
  | 'forum_comment_delete';

export type BusinessAction =
  | 'business_create' | 'business_delete' | 'business_invite' | 'business_loan_request'
  | 'business_loan_decision' | 'business_loan_repay' | 'business_deposit' | 'business_withdraw'
  | 'business_invest' | 'business_transfer' | 'business_transfer_fee_update'
  | 'business_buyout_offer_create' | 'business_buyout_offer_respond' | 'business_buyout_offer_cancel'
  | 'business_share_proposal_create' | 'business_share_proposal_review' | 'business_share_proposal_cancel'
  | 'business_research_start' | 'business_product_deploy' | 'business_collect' | 'business_sale'
  | 'business_profile_update' | 'business_invitation_respond' | 'business_member_sack'
  | 'business_member_salary_update' | 'business_formation_product_buy' | 'business_rate'
  | 'bank_upgrade_purchase' | 'bank_rate_update' | 'bank_daily_revenue'
  | 'bank_account_open' | 'bank_account_deposit' | 'bank_account_withdraw'
  | 'formation_update' | 'formation_purchase' | 'formation_product_create'
  | 'formation_product_update' | 'formation_product_delete' | 'formation_product_review'
  | 'relationship_create' | 'relationship_forget' | 'relationship_reactivate'
  | 'marriage_proposal' | 'marriage_response' | 'divorce_proposal' | 'divorce_response'
  | 'relationship_force_divorce' | 'relationship_mistress' | 'relationship_cheating_report'
  | 'relationship_court_case' | 'couple_deposit' | 'couple_withdraw';

export type LogAction = AuthAction | ChatAction | GameAction | EconomyAction | PartyAction | SuggestionAction | MarketplaceAction | AdminAction | BanAction | AuraCoinAction | BusinessAction | ForumAction;

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

export const logBusiness = (action: BusinessAction, userId?: string | null, username?: string | null, targetId?: string | null, targetName?: string | null, details?: Record<string, unknown>) =>
  createLog({ type: 'BUSINESS', action, userId, username, targetId, targetName, details });

export const logForum = (action: ForumAction, userId?: string | null, username?: string | null, details?: Record<string, unknown>) =>
  createLog({ type: 'FORUM', action, userId, username, details });
