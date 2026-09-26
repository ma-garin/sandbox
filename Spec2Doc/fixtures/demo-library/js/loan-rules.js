// 貸出可否の判定と延滞料金
export const MEMBER_TYPES = ['general', 'student', 'staff'];
export const LIMIT_GENERAL = 5;
export const LIMIT_STUDENT = 3;
export const LIMIT_STAFF = 10;
export const FEE_PER_DAY = 10;
export const FEE_CAP = 500;

export function loanLimit(memberType) {
  switch (memberType) {
    case 'general':
      return LIMIT_GENERAL;
    case 'student':
      return LIMIT_STUDENT;
    case 'staff':
      return LIMIT_STAFF;
    default:
      return 0;
  }
}

/**
 * 貸出可否のデシジョン。
 * 会員種別 × 延滞の有無 × 現在の冊数 で決まる。延滞ありは種別によらず不可。
 */
export function canLoan(member, currentCount, requestedCount) {
  if (!member || !MEMBER_TYPES.includes(member.type)) {
    return { ok: false, reason: '会員種別が不明です' };
  }
  if (member.suspended || member.hasOverdue) {
    return { ok: false, reason: '延滞中の本があるため貸出できません' };
  }
  const limit = loanLimit(member.type);
  if (currentCount + requestedCount > limit) {
    return { ok: false, reason: `貸出上限（${limit} 冊）を超えます` };
  }
  if (member.type === 'student' && !member.studentCardValid) {
    return { ok: false, reason: '学生証の有効期限が切れています' };
  }
  if (!(member.type === 'staff') && requestedCount > 5) {
    return { ok: false, reason: '一度に借りられるのは 5 冊までです' };
  }
  return { ok: true, reason: '' };
}

/** 延滞料金: 1 日 10 円、上限 500 円 */
export function calcLateFee(overdueDays) {
  if (overdueDays <= 0) return 0;
  return Math.min(overdueDays * FEE_PER_DAY, FEE_CAP);
}

/** 返却期限（日数）: 職員 30 日、それ以外 14 日 */
export function dueDays(memberType) {
  return memberType === 'staff' ? 30 : 14;
}
