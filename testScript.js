// 測試腳本：自動測試智能分帳助手主要功能，並建立版本號

(async function testApp() {
  const version = '1.0.0';
  console.log(`開始測試智能分帳助手，版本號: ${version}`);

  // 等待指定毫秒數
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 模擬輸入參與者
  async function addParticipant(name) {
    document.getElementById('participantName').value = name;
    window.addParticipant();
    await delay(500);
    console.log(`新增參與者: ${name}`);
  }

  // 模擬新增支出
  async function addExpense(description, amount, payerName, note = '') {
    document.getElementById('expenseDescription').value = description;
    document.getElementById('expenseAmount').value = amount;
    // 選擇付款人
    const payerSelect = document.getElementById('expensePayer');
    for (let option of payerSelect.options) {
      if (option.text === payerName) {
        payerSelect.value = option.value;
        break;
      }
    }
    document.getElementById('expenseNote').value = note;
    window.addExpense();
    await delay(500);
    console.log(`新增支出: ${description}, 金額: ${amount}, 付款人: ${payerName}, 備註: ${note}`);
  }

  // 模擬切換貨幣
  async function changeCurrency(currency) {
    window.showCurrencyModal();
    await delay(300);
    const radios = document.querySelectorAll('input[name="currency"]');
    radios.forEach(radio => {
      if (radio.value === currency) {
        radio.checked = true;
      }
    });
    window.setCurrency();
    await delay(500);
    console.log(`切換貨幣為: ${currency}`);
  }

  // 模擬匯出結果
  async function exportResults() {
    window.exportResults();
    await delay(500);
    console.log('匯出結果');
  }

  // 模擬清除資料
  async function clearData() {
    window.clearAllData();
    await delay(500);
    console.log('清除所有資料');
  }

  // 開始測試流程
  try {
    await clearData();

    await addParticipant('Alice');
    await addParticipant('Bob');
    await addParticipant('Charlie');

    await addExpense('午餐', 300, 'Alice', '聚餐費用');
    await addExpense('飲料', 150, 'Bob');
    await addExpense('交通', 200, 'Charlie', '計程車');

    await changeCurrency('USD');

    await exportResults();

    console.log('所有功能測試完成，版本號:', version);
  } catch (error) {
    console.error('測試過程發生錯誤:', error);
  }
})();
