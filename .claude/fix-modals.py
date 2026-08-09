"""Replace inline modal styles with CSS classes in index.html."""
import re

PATH = r"e:\同济学习\毕业论文\论文文献AI利器\index.html"
with open(PATH, "r", encoding="utf-8") as f:
    html = f.read()

changes = 0

# ── 1. Recharge modal overlay ──
old = '<div id="rechargeModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-overlay);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:100070;align-items:center;justify-content:center" onclick="hideRechargeModal()">'
new = '<div id="rechargeModal" class="modal-overlay hidden" style="display:none" onclick="hideRechargeModal()">'
if old in html:
    html = html.replace(old, new)
    changes += 1

# Recharge card: inline → modal-card class
old = '<div style="background:var(--bg-card);border-radius:var(--radius-xl);padding:24px;width:520px;max-width:96%;max-height:85vh;overflow-y:auto;border:1px solid var(--border);box-shadow:var(--shadow-lg)" onclick="event.stopPropagation()">'
new = '<div class="modal-card" style="width:520px;max-width:96%;max-height:85vh;overflow-y:auto;padding:24px" onclick="event.stopPropagation()">'
if old in html:
    html = html.replace(old, new)
    changes += 1

# Recharge header: inline → modal-header
old = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">\n      <h3 style="font-size:var(--font-size-xl);color:var(--text-primary);margin:0;font-weight:var(--font-weight-bold)">充值</h3>\n      <button onclick="hideRechargeModal()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;font-family:var(--font-sans)">&times;</button>\n    </div>'
new_repl = '<div class="modal-header">\n      <h3 class="modal-header-title">充值</h3>\n      <button class="modal-close" onclick="hideRechargeModal()">&times;</button>\n    </div>'
if old in html:
    html = html.replace(old, new_repl)
    changes += 1

# Recharge input: inline → .input
old = '<input type="text" inputmode="decimal" id="rechargeAmountInput" autocomplete="off" placeholder="请输入充值金额" aria-describedby="rechargePointsPreview rechargeAmountError" style="flex:1;min-width:140px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-size:.9rem;font-family:var(--font-sans)">'
new_ri = '<input type="text" inputmode="decimal" id="rechargeAmountInput" autocomplete="off" placeholder="请输入充值金额" aria-describedby="rechargePointsPreview rechargeAmountError" class="input" style="flex:1;min-width:140px;font-size:.9rem">'
if old in html:
    html = html.replace(old, new_ri)
    changes += 1

# Recharge payment section bg
old = '<div id="rechargePayment" style="display:none;padding:14px;background:var(--surface-alt);border-radius:var(--radius-lg);border:1px solid var(--border);margin-bottom:12px">'
new_rp = '<div id="rechargePayment" class="recharge-payment-section" style="display:none">'
if old in html:
    html = html.replace(old, new_rp)
    changes += 1

# Recharge submit button: inline → ai-btn
old = '<button id="rechargeSubmitBtn" onclick="submitRecharge()" style="width:100%;padding:12px;border-radius:var(--radius-md);border:none;background:var(--accent);color:#fff;cursor:pointer;font-weight:var(--font-weight-bold);font-size:var(--font-size-base);font-family:var(--font-sans)">创建订单并显示支付说明</button>'
new_rs = '<button id="rechargeSubmitBtn" onclick="submitRecharge()" class="ai-btn" style="width:100%">创建订单并显示支付说明</button>'
if old in html:
    html = html.replace(old, new_rs)
    changes += 1

# Recharge password inputs: inline → .input
old = '<input type="password" id="pwOld" placeholder="原密码" style="flex:1;min-width:80px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 10px;font-size:var(--font-size-sm);color:var(--text-primary);outline:none;font-family:var(--font-sans)">'
new_pw = '<input type="password" id="pwOld" placeholder="原密码" class="input" style="flex:1;min-width:80px;padding:7px 10px;font-size:var(--text-sm)">'
if old in html:
    html = html.replace(old, new_pw)
    changes += 1

old = '<input type="password" id="pwNew" placeholder="新密码(6位+)" style="flex:1;min-width:80px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 10px;font-size:var(--font-size-sm);color:var(--text-primary);outline:none;font-family:var(--font-sans)">'
new_pw2 = '<input type="password" id="pwNew" placeholder="新密码(6位+)" class="input" style="flex:1;min-width:80px;padding:7px 10px;font-size:var(--text-sm)">'
if old in html:
    html = html.replace(old, new_pw2)
    changes += 1

old = '<button onclick="changePassword()" style="padding:7px 14px;border:none;border-radius:var(--radius-sm);background:var(--accent);color:#fff;font-size:var(--font-size-sm);cursor:pointer;font-weight:var(--font-weight-semibold);font-family:var(--font-sans)">修改</button>'
new_cp = '<button onclick="changePassword()" class="ai-btn" style="padding:7px 14px;font-size:var(--text-sm)">修改</button>'
if old in html:
    html = html.replace(old, new_cp)
    changes += 1

# ── 2. Account center overlay ──
old = '<div id="accountCenterMask" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(6px);z-index:100065;align-items:center;justify-content:center" onclick="closeAccountCenter()">'
new_ac = '<div id="accountCenterMask" class="modal-overlay hidden" style="display:none" onclick="closeAccountCenter()">'
if old in html:
    html = html.replace(old, new_ac)
    changes += 1

# Account center card
old = '<div id="accountCenter" style="background:var(--bg-card,#fff);border-radius:16px;width:min(920px,96vw);max-height:88vh;overflow:hidden;border:1px solid var(--border,#e5e7eb);box-shadow:0 24px 64px rgba(0,0,0,.22);display:flex;flex-direction:column" onclick="event.stopPropagation()">'
new_acc = '<div id="accountCenter" class="modal-card" style="width:min(920px,96vw);max-height:88vh" onclick="event.stopPropagation()">'
if old in html:
    html = html.replace(old, new_acc)
    changes += 1

# ── 3. Notification panel ──
old = '<div id="notifyPanel" style="display:none;position:fixed;top:52px;right:12px;width:360px;max-width:92vw;max-height:70vh;overflow:hidden;background:var(--bg-card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.22);z-index:100060">'
new_np = '<div id="notifyPanel" class="notify-panel" style="display:none">'
if old in html:
    html = html.replace(old, new_np)
    changes += 1

# Notify header
old = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border,#e5e7eb)">\n    <b style="font-size:.85rem;color:var(--text-primary,#111)">消息中心</b>\n    <div style="display:flex;gap:8px;align-items:center">\n      <button type="button" onclick="markAllNotificationsRead()" style="background:none;border:none;color:var(--accent,#4f46e5);font-size:.68rem;cursor:pointer;font-weight:600">全部已读</button>\n      <button type="button" onclick="toggleNotifyPanel(false)" style="background:none;border:none;color:var(--text-muted,#999);cursor:pointer;font-size:.9rem">✕</button>\n    </div>\n  </div>'
new_nh = '<div class="notify-header"><b>消息中心</b><div class="notify-header-actions"><button type="button" onclick="markAllNotificationsRead()" class="notify-read-all">全部已读</button><button type="button" onclick="toggleNotifyPanel(false)" class="notify-close">✕</button></div></div>'
if old in html:
    html = html.replace(old, new_nh)
    changes += 1

# Notify list
old = '<div id="notifyList" style="max-height:56vh;overflow-y:auto;padding:6px 0"></div>'
new_nl = '<div id="notifyList" class="notify-list"></div>'
if old in html:
    html = html.replace(old, new_nl)
    changes += 1

# ── 4. Changelog button ──
old = '<div id="changelogBtn" onclick="toggleChangelog()" title="更新日志" style="display:none;position:fixed;top:52px;right:12px;z-index:1000;font-size:.62rem;color:#0071e3;cursor:pointer;background:rgba(0,113,227,.08);padding:3px 10px;border-radius:12px;border:1px solid rgba(0,113,227,.2);transition:all .2s;font-weight:600" onmouseenter="this.style.background=\'rgba(0,113,227,.15)\'" onmouseleave="this.style.background=\'rgba(0,113,227,.08)\'">📜 更新日志</div>'
new_cb = '<div id="changelogBtn" class="changelog-fab" onclick="toggleChangelog()" title="更新日志" style="display:none">📜 更新日志</div>'
if old in html:
    html = html.replace(old, new_cb)
    changes += 1

# Changelog panel
old_start = html.find('<div id="changelogPanel" style="display:none;')
old_end = html.find('</div>\n\n<!-- 命令面板覆盖层 -->')
if old_start >= 0 and old_end > old_start:
    # Replace the entire changelog panel with class-based version
    old_chunk = html[old_start:old_end]
    # Build new version - keep inner content, replace outer wrapper
    inner_start = old_chunk.find('>') + 1
    inner_end = old_chunk.rfind('</div>')
    inner = old_chunk[inner_start:inner_end]

    new_panel = '<div id="changelogPanel" class="changelog-panel" style="display:none">\n' + \
        '  <div class="notify-header"><b>📜 功能更新日志</b>' + \
        '<button class="notify-close" onclick="document.getElementById(\'changelogPanel\').style.display=\'none\'">✕</button></div>\n' + \
        '  <div class="changelog-list">' + \
        re.sub(r'style="[^"]*"', '',
               re.sub(r'<b style="[^"]*">', '<b>',
                      re.sub(r'<span onclick="[^"]*" style="[^"]*">', '<span onclick="document.getElementById(\'changelogPanel\').style.display=\'none\'">',
                             inner.strip()))).strip() + \
        '</div>\n</div>'
    html = html[:old_start] + new_panel + html[old_end:]
    changes += 1

# ── 5. Account modal (legacy) ──
old = '<div id="accountModalMask" class="acct-mask" style="display:none">'
new_am = '<div id="accountModalMask" class="acct-mask modal-overlay hidden" style="display:none">'
if old in html:
    html = html.replace(old, new_am)
    changes += 1

# ── 6. Remove inline <style> block and add to components.css ──
old_style_start = html.find('.acct-tab{')
old_style_end = html.find('}\n</script>', html.find('switchAcctTab', html.find('.acct-tab{')))
if old_style_start >= 0 and old_style_end > old_style_start:
    old_style_end += 1  # include closing }

with open(PATH, "w", encoding="utf-8") as f:
    f.write(html)

print(f"Changes applied: {changes}")
