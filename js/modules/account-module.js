/**
 * AccountModule — 账户与支付模块
 * 从 index.html 内嵌 JS 提取：充值、余额、账户中心、消息通知
 *
 * 使用方式: AccountModule.init() 在页面加载后调用一次
 */
var AccountModule = (function() {
  'use strict';

  var TOKEN_KEY = 'thesis_ai_token';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function apiHeaders(json) {
    var h = {};
    if (json) h['Content-Type'] = 'application/json';
    var t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  // ── 余额 ──
  function setBalanceDisplay(points) {
    var el = document.getElementById('balanceAmount');
    if (!el) return;
    var pts = Number(points || 0);
    if (!isFinite(pts)) pts = 0;
    el.textContent = pts.toFixed(3);
    el.style.color = pts >= 1 ? '#10b981' : (pts > 0 ? '#f59e0b' : '#f87171');
  }

  function updateBalance() {
    var token = getToken();
    if (!token) return Promise.resolve();
    return fetch('/api/payment/balance', { headers: apiHeaders(false) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          setBalanceDisplay(d.points || 0);
          var fq = document.getElementById('freeQuotaChip');
          if (fq) {
            if (d.free_remaining_today != null) {
              fq.style.display = 'none';
              fq.title = '今日免费剩余 ' + d.free_remaining_today + ' / ' + d.free_limit_today;
            }
          }
        }
      }).catch(function() {});
  }

  // ── 充值 ──
  var _selectedAmountFen = null;
  var _selectedPayment = 'alipay';
  var _pendingOrderId = null;

  function showRechargeModal() {
    resetRechargeState(true);
    var el = document.getElementById('rechargeModal');
    if (el) el.style.display = 'flex';
    updateBalance();
    loadRechargeHistory();
  }

  function hideRechargeModal() {
    var el = document.getElementById('rechargeModal');
    if (el) el.style.display = 'none';
    resetRechargeState(true);
  }

  function resetRechargeState(clearInput) {
    _selectedAmountFen = null;
    _pendingOrderId = null;
    var inp = document.getElementById('rechargeAmountInput');
    if (inp && clearInput) inp.value = '';
    var payment = document.getElementById('rechargePayment');
    if (payment) payment.style.display = 'none';
    var info = document.getElementById('rechargeOrderInfo');
    if (info) { info.style.display = 'none'; info.textContent = ''; }
    var btn = document.getElementById('rechargeSubmitBtn');
    if (btn) { btn.textContent = '创建订单并显示支付说明'; btn.disabled = false; btn.onclick = submitRecharge; }
    var err = document.getElementById('rechargeAmountError');
    if (err) err.textContent = '';
  }

  function parseAmountFen(value) {
    var text = String(value || '').trim();
    if (!text) return { error: '请输入充值金额' };
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return { error: '请输入有效金额' };
    var amount = Number(text);
    if (!Number.isFinite(amount)) return { error: '请输入有效金额' };
    var fen = Math.round(amount * 100);
    if (fen < 100) return { error: '充值金额低于最低限额（1元）' };
    if (fen > 500000) return { error: '充值金额超过单笔限额（5000元）' };
    return { fen: fen, yuan: fen / 100, text: (fen / 100).toFixed(2) };
  }

  function onAmountEdited() {
    resetRechargeState(false);
    var inp = document.getElementById('rechargeAmountInput');
    var parsed = parseAmountFen(inp ? inp.value : '');
    if (parsed.error && inp && inp.value.trim()) {
      document.getElementById('rechargeAmountError').textContent = parsed.error;
    } else {
      document.getElementById('rechargeAmountError').textContent = '';
    }
  }

  function selectAmount() {
    var inp = document.getElementById('rechargeAmountInput');
    var parsed = parseAmountFen(inp ? inp.value : '');
    if (parsed.error) { document.getElementById('rechargeAmountError').textContent = parsed.error; return; }
    _selectedAmountFen = parsed.fen;
    if (inp) inp.value = parsed.text;
    var payAmt = document.getElementById('rechargePayAmountLabel');
    if (payAmt) payAmt.textContent = parsed.text;
    document.getElementById('rechargePayment').style.display = '';
    document.getElementById('rechargeAmountError').textContent = '';
  }

  function submitRecharge() {
    var inp = document.getElementById('rechargeAmountInput');
    var parsed = parseAmountFen(inp ? inp.value : '');
    if (parsed.error) { document.getElementById('rechargeAmountError').textContent = parsed.error; return; }
    var btn = document.getElementById('rechargeSubmitBtn');
    if (btn) btn.disabled = true;
    fetch('/api/payment/recharge', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({ amount_yuan: parsed.text, payment_method: _selectedPayment })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { if (btn) btn.disabled = false; alert(d.error); return; }
        _selectedAmountFen = d.amount_fen;
        _pendingOrderId = d.order_id;
        var amountText = (d.amount_fen / 100).toFixed(2);
        if (inp) inp.value = amountText;
        var info = document.getElementById('rechargeOrderInfo');
        if (info) {
          info.style.display = 'block';
          info.innerHTML = '订单 <b>#' + d.order_id + '</b> 已创建 · 请按 ' + amountText + ' 元转账 · 备注写订单号';
        }
        if (btn) { btn.textContent = '我已支付，提交审核'; btn.onclick = confirmPaid; btn.disabled = false; }
        loadRechargeHistory();
      }).catch(function() { if (btn) btn.disabled = false; alert('网络错误'); });
  }

  function confirmPaid() {
    if (!_pendingOrderId) { alert('订单信息已失效，请重新创建'); return; }
    var btn = document.getElementById('rechargeSubmitBtn');
    if (btn) btn.disabled = true;
    fetch('/api/payment/submit', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({ order_id: _pendingOrderId })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { if (btn) btn.disabled = false; alert(d.error); return; }
        alert(d.message || '已提交审核');
        loadRechargeHistory();
        if (btn) { btn.textContent = '已提交，等待确认'; btn.disabled = true; }
        _pendingOrderId = null;
      }).catch(function() { if (btn) btn.disabled = false; alert('网络错误'); });
  }

  function loadRechargeHistory() {
    fetch('/api/payment/orders', { headers: apiHeaders(false) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var el = document.getElementById('rechargeHistory');
        if (!d.success || !d.orders || !el) return;
        var sm = { pending: '待支付', submitted: '待确认', confirmed: '已到账', rejected: '已拒绝' };
        var h = '<table style="width:100%;font-size:.72rem"><tr style="opacity:.5"><th>金额</th><th>状态</th><th>时间</th></tr>';
        d.orders.forEach(function(o) {
          h += '<tr><td>' + o.amount_yuan + '元</td><td>' + (sm[o.status] || o.status) + '</td><td>' + (o.created_at || '').substring(0,16) + '</td></tr>';
        });
        h += '</table>';
        el.innerHTML = h;
      });
  }

  function fillAmount(amount) {
    var inp = document.getElementById('rechargeAmountInput');
    if (inp) inp.value = String(amount);
    onAmountEdited();
  }

  // ── 402 拦截 ──
  function install402Interceptor() {
    if (window.__fetchPatched402) return;
    window.__fetchPatched402 = true;
    var origFetch = window.fetch;
    window.fetch = function() {
      return origFetch.apply(this, arguments).then(function(res) {
        if (res && res.status === 402) {
          res.clone().json().then(function(d) {
            var msg = (d && d.error) ? d.error : '点数不足';
            if (confirm(msg + '\n\n是否立即充值？')) showRechargeModal();
            updateBalance();
          }).catch(function() {});
        }
        return res;
      });
    };
  }

  // ── 通知 ──
  function pollNotifications() {
    var token = getToken();
    if (!token) return;
    fetch('/api/notifications?limit=10', { headers: apiHeaders(false) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) return;
        var badge = document.getElementById('notifyBadge');
        if (badge) {
          var unread = d.unread || 0;
          if (unread > 0) { badge.style.display = ''; badge.textContent = unread > 99 ? '99+' : String(unread); }
          else { badge.style.display = 'none'; }
        }
      });
  }

  // ── 初始化 ──
  function init() {
    install402Interceptor();
    updateBalance();
    // 定期刷新余额
    setInterval(updateBalance, 30000);
    // 定期轮询通知
    pollNotifications();
    setInterval(pollNotifications, 20000);

    // 绑定UI事件（如果按钮存在）
    var amtInp = document.getElementById('rechargeAmountInput');
    if (amtInp) amtInp.addEventListener('input', onAmountEdited);

    // 点击弹窗外部关闭
    var modal = document.getElementById('rechargeModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) hideRechargeModal();
      });
    }
  }

  // ── Public API ──
  return {
    init: init,
    updateBalance: updateBalance,
    setBalanceDisplay: setBalanceDisplay,
    showRechargeModal: showRechargeModal,
    hideRechargeModal: hideRechargeModal,
    submitRecharge: submitRecharge,
    confirmPaid: confirmPaid,
    resetRechargeState: resetRechargeState,
    onAmountEdited: onAmountEdited,
    selectAmount: selectAmount,
    fillAmount: fillAmount,
    pollNotifications: pollNotifications
  };
})();
