/**
 * Account + Recharge Module — 从 index.html 内联脚本提取
 * 充值弹窗、余额显示、账户中心
 */
var AccountModule = (function() {
  'use strict';

  var _selectedAmountFen = null;
  var _selectedPayment = 'alipay';
  var _pendingOrderId = null;

  function getToken() { try { return sessionStorage.getItem('thesis_ai_token') || ''; } catch(e) { return ''; } }
  function apiHeaders(json) { var h = {}; if (json) h['Content-Type'] = 'application/json'; var t = getToken(); if (t) h['Authorization'] = 'Bearer ' + t; return h; }

  // ── 余额 ──
  function updateBalanceDisplay() {
    var token = getToken();
    if (!token) return;
    fetch('/api/payment/balance', { headers: apiHeaders(false) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) return;
        var el = document.getElementById('balanceAmount');
        if (el) {
          var pts = Number(d.points || 0);
          if (!isFinite(pts)) pts = 0;
          el.textContent = pts.toFixed(3);
          el.style.color = pts >= 1 ? '#10b981' : (pts > 0 ? '#f59e0b' : '#f87171');
        }
        if (window.TB && TB.state) TB.state.set('balance', d.points || 0);
      });
  }
  window.updateBalanceDisplay = updateBalanceDisplay;
  window.setBalanceDisplay = function(points) {
    var el = document.getElementById('balanceAmount');
    if (!el) return;
    var pts = Number(points || 0);
    if (!isFinite(pts)) pts = 0;
    el.textContent = pts.toFixed(3);
    el.style.color = pts >= 1 ? '#10b981' : (pts > 0 ? '#f59e0b' : '#f87171');
  };

  // ── 充值 ──
  function showRechargeModal() {
    resetRecharge(true);
    var el = document.getElementById('rechargeModal');
    if (el) el.style.display = 'flex';
    updateBalanceDisplay();
    loadRechargeHistory();
  }

  function hideRechargeModal() {
    var el = document.getElementById('rechargeModal');
    if (el) el.style.display = 'none';
    resetRecharge(true);
  }

  function resetRecharge(clearInput) {
    _selectedAmountFen = null;
    _pendingOrderId = null;
    if (clearInput) {
      var inp = document.getElementById('rechargeAmountInput');
      if (inp) inp.value = '';
    }
    var payment = document.getElementById('rechargePayment');
    if (payment) payment.style.display = 'none';
    var info = document.getElementById('rechargeOrderInfo');
    if (info) { info.style.display = 'none'; info.textContent = ''; }
    var btn = document.getElementById('rechargeSubmitBtn');
    if (btn) { btn.textContent = '创建订单并显示支付说明'; btn.disabled = false; btn.onclick = submitRecharge; }
    var err = document.getElementById('rechargeAmountError');
    if (err) err.textContent = '';
  }

  function parseAmountFen(text) {
    text = String(text || '').trim();
    if (!text) return { error: '请输入充值金额' };
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return { error: '请输入有效金额' };
    var amount = Number(text);
    if (!Number.isFinite(amount)) return { error: '请输入有效金额' };
    var fen = Math.round(amount * 100);
    if (fen < 100) return { error: '最低充值 1 元' };
    if (fen > 500000) return { error: '单笔最高 5000 元' };
    return { fen: fen, yuan: fen / 100, text: (fen / 100).toFixed(2) };
  }

  function onAmountEdited() {
    resetRecharge(false);
    var inp = document.getElementById('rechargeAmountInput');
    var parsed = parseAmountFen(inp ? inp.value : '');
    var err = document.getElementById('rechargeAmountError');
    if (err) err.textContent = parsed.error || '';
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
      method: 'POST', headers: apiHeaders(true),
      body: JSON.stringify({ amount_yuan: parsed.text, payment_method: _selectedPayment })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { if (btn) btn.disabled = false; alert(d.error); return; }
        _selectedAmountFen = d.amount_fen;
        _pendingOrderId = d.order_id;
        var text = (d.amount_fen / 100).toFixed(2);
        if (inp) inp.value = text;
        var info = document.getElementById('rechargeOrderInfo');
        if (info) { info.style.display = 'block'; info.innerHTML = '订单 <b>#' + d.order_id + '</b> · 请按 ' + text + ' 元转账 · 备注订单号'; }
        if (btn) { btn.textContent = '我已支付，提交审核'; btn.onclick = confirmPaid; btn.disabled = false; }
        loadRechargeHistory();
      }).catch(function() { if (btn) btn.disabled = false; alert('网络错误'); });
  }

  function confirmPaid() {
    if (!_pendingOrderId) { alert('订单已失效，请重新创建'); return; }
    var btn = document.getElementById('rechargeSubmitBtn');
    if (btn) btn.disabled = true;
    fetch('/api/payment/submit', {
      method: 'POST', headers: apiHeaders(true),
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

  function fillAmount(amount) {
    var inp = document.getElementById('rechargeAmountInput');
    if (inp) inp.value = String(amount);
    onAmountEdited();
  }

  function switchQR(method) {
    _selectedPayment = method || 'alipay';
    document.querySelectorAll('.recharge-qr-card').forEach(function(card) {
      var active = card.getAttribute('data-method') === _selectedPayment;
      card.style.borderColor = active ? 'var(--accent)' : 'transparent';
      card.style.boxShadow = active ? '0 0 0 1px var(--accent)' : 'none';
    });
    var lab = document.getElementById('rechargePayMethodLabel');
    if (lab) lab.textContent = _selectedPayment === 'wechat' ? '微信' : '支付宝';
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

  function changePassword() {
    var oldPw = document.getElementById('pwOld');
    var newPw = document.getElementById('pwNew');
    var msg = document.getElementById('pwMsg');
    var oldVal = oldPw ? oldPw.value : '';
    var newVal = newPw ? newPw.value : '';
    if (!oldVal || !newVal) { msg.textContent = '请填写原密码和新密码'; msg.style.color = '#fca5a5'; return; }
    fetch('/api/auth/change_password', {
      method: 'POST', headers: apiHeaders(true),
      body: JSON.stringify({ old_password: oldVal, new_password: newVal })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) { msg.textContent = d.message; msg.style.color = '#34d399'; }
        else { msg.textContent = d.error; msg.style.color = '#fca5a5'; }
      }).catch(function() { msg.textContent = '网络错误'; msg.style.color = '#fca5a5'; });
  }

  // ── 初始化 ──
  function init() {
    // 绑定全局函数
    window.showRechargeModal = showRechargeModal;
    window.hideRechargeModal = hideRechargeModal;
    window.switchQR = switchQR;
    window.submitRecharge = submitRecharge;
    window.confirmPaid = confirmPaid;
    window.fillRechargeAmount = fillAmount;
    window.onRechargeAmountEdited = onAmountEdited;
    window.selectRechargeAmountFromInput = selectAmount;
    window.changePassword = changePassword;
    window.resetRechargePaymentStep = resetRecharge;

    // 绑定 UI 事件
    var amtInp = document.getElementById('rechargeAmountInput');
    if (amtInp) amtInp.addEventListener('input', onAmountEdited);

    // 关闭弹窗（点击背景）
    var modal = document.getElementById('rechargeModal');
    if (modal) {
      modal.addEventListener('click', function(e) { if (e.target === modal) hideRechargeModal(); });
    }

    // 余额轮询
    updateBalanceDisplay();
    setInterval(updateBalanceDisplay, 30000);
  }

  return {
    init: init,
    showRechargeModal: showRechargeModal,
    hideRechargeModal: hideRechargeModal,
    updateBalanceDisplay: updateBalanceDisplay,
    fillAmount: fillAmount,
    switchQR: switchQR,
    changePassword: changePassword
  };
})();
