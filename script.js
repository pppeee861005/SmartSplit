// 資料結構定義
class Participant {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.totalPaid = 0;
        this.shouldPay = 0;
        this.balance = 0;
    }
}

class Expense {
    constructor(id, description, amount, paidBy, note = '') {
        this.id = id;
        this.description = description;
        this.amount = parseFloat(amount);
        this.paidBy = paidBy;
        this.note = note;
        this.timestamp = new Date();
    }
}

// 儲存管理器
class StorageManager {
    static saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('儲存資料失敗:', error);
        }
    }

    static loadData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('載入資料失敗:', error);
            return null;
        }
    }

    static clearData(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('清除資料失敗:', error);
        }
    }
}

// 匯出管理器
class ExportManager {
    static exportToText(participants, expenses, currency) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('zh-TW');
        const timeStr = now.toLocaleTimeString('zh-TW');
        
        let content = `=== 分帳結果 ===\n`;
        content += `匯出時間: ${dateStr} ${timeStr}\n`;
        content += `貨幣: ${currency}\n\n`;
        
        // 支出明細
        content += `--- 支出明細 ---\n`;
        let totalExpense = 0;
        expenses.forEach((expense, index) => {
            const payer = participants.find(p => p.id === expense.paidBy);
            content += `${index + 1}. ${expense.description}\n`;
            content += `   金額: ${this.formatCurrency(expense.amount, currency)}\n`;
            content += `   付款人: ${payer ? payer.name : '未知'}\n`;
            if (expense.note) {
                content += `   備註: ${expense.note}\n`;
            }
            content += `   時間: ${expense.timestamp.toLocaleString('zh-TW')}\n\n`;
            totalExpense += expense.amount;
        });
        
        content += `總支出: ${this.formatCurrency(totalExpense, currency)}\n`;
        content += `每人應付: ${this.formatCurrency(totalExpense / participants.length, currency)}\n\n`;
        
        // 餘額狀況
        content += `--- 餘額狀況 ---\n`;
        participants.forEach(participant => {
            content += `${participant.name}:\n`;
            content += `  已付: ${this.formatCurrency(participant.totalPaid, currency)}\n`;
            content += `  應付: ${this.formatCurrency(participant.shouldPay, currency)}\n`;
            content += `  餘額: ${this.formatCurrency(participant.balance, currency)}`;
            
            if (participant.balance > 0) {
                content += ` (應收)\n`;
            } else if (participant.balance < 0) {
                content += ` (應付)\n`;
            } else {
                content += ` (已結清)\n`;
            }
            content += `\n`;
        });
        
        // 轉帳建議
        const transfers = ExpenseManager.generateTransferSuggestions(participants);
        if (transfers.length > 0) {
            content += `--- 轉帳建議 ---\n`;
            transfers.forEach((transfer, index) => {
                content += `${index + 1}. ${transfer.fromName} → ${transfer.toName}: ${this.formatCurrency(transfer.amount, currency)}\n`;
            });
        }
        
        return content;
    }

    static formatCurrency(amount, currency) {
        const symbols = {
            'TWD': 'NT$',
            'USD': '$',
            'JPY': '¥',
            'HKD': 'HK$',
            'CNY': '¥'
        };
        
        const symbol = symbols[currency] || currency;
        return `${symbol}${Math.abs(amount).toFixed(2)}`;
    }

    static downloadFile(content, filename) {
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('下載檔案失敗:', error);
            showToast('下載失敗，請稍後再試', 'error');
        }
    }
}

// 支出管理器
class ExpenseManager {
    constructor() {
        this.participants = [];
        this.expenses = [];
        this.currency = 'TWD';
        this.loadData();
    }

    addParticipant(name) {
        if (this.participants.length >= 5) {
            throw new Error('最多只能添加5位參與者');
        }
        
        if (this.participants.some(p => p.name === name)) {
            throw new Error('參與者姓名不能重複');
        }

        const id = Date.now().toString();
        const participant = new Participant(id, name);
        this.participants.push(participant);
        this.saveData();
        return participant;
    }

    removeParticipant(id) {
        // 檢查是否有相關支出
        const hasExpenses = this.expenses.some(expense => expense.paidBy === id);
        if (hasExpenses) {
            throw new Error('此參與者有相關支出記錄，無法刪除');
        }

        this.participants = this.participants.filter(p => p.id !== id);
        this.saveData();
    }

    addExpense(description, amount, paidBy, note = '') {
        if (!description.trim()) {
            throw new Error('請輸入支出描述');
        }
        
        if (amount <= 0) {
            throw new Error('金額必須大於0');
        }
        
        if (!this.participants.find(p => p.id === paidBy)) {
            throw new Error('付款人不存在');
        }

        const id = Date.now().toString();
        const expense = new Expense(id, description.trim(), amount, paidBy, note.trim());
        this.expenses.push(expense);
        this.calculateBalances();
        this.saveData();
        return expense;
    }

    removeExpense(id) {
        this.expenses = this.expenses.filter(e => e.id !== id);
        this.calculateBalances();
        this.saveData();
    }

    calculateBalances() {
        // 重置所有參與者的金額
        this.participants.forEach(participant => {
            participant.totalPaid = 0;
            participant.shouldPay = 0;
            participant.balance = 0;
        });

        // 計算總支出
        const totalExpense = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        if (totalExpense === 0 || this.participants.length === 0) {
            return;
        }

        // 計算每人應付金額
        const perPersonAmount = totalExpense / this.participants.length;

        // 計算每人實際支付金額
        this.expenses.forEach(expense => {
            const payer = this.participants.find(p => p.id === expense.paidBy);
            if (payer) {
                payer.totalPaid += expense.amount;
            }
        });

        // 計算餘額
        this.participants.forEach(participant => {
            participant.shouldPay = perPersonAmount;
            participant.balance = participant.totalPaid - participant.shouldPay;
        });
    }

    static generateTransferSuggestions(participants) {
        const transfers = [];
        
        // 分離債權人和債務人
        const creditors = participants.filter(p => p.balance > 0.01).sort((a, b) => b.balance - a.balance);
        const debtors = participants.filter(p => p.balance < -0.01).sort((a, b) => a.balance - b.balance);

        let i = 0, j = 0;
        
        while (i < creditors.length && j < debtors.length) {
            const creditor = creditors[i];
            const debtor = debtors[j];
            
            const transferAmount = Math.min(creditor.balance, Math.abs(debtor.balance));
            
            if (transferAmount > 0.01) {
                transfers.push({
                    from: debtor.id,
                    to: creditor.id,
                    fromName: debtor.name,
                    toName: creditor.name,
                    amount: Math.round(transferAmount)
                });
                
                creditor.balance -= transferAmount;
                debtor.balance += transferAmount;
            }
            
            if (Math.abs(creditor.balance) < 0.01) i++;
            if (Math.abs(debtor.balance) < 0.01) j++;
        }
        
        return transfers;
    }

    setCurrency(currency) {
        this.currency = currency;
        this.saveData();
    }

    saveData() {
        const data = {
            participants: this.participants,
            expenses: this.expenses,
            currency: this.currency
        };
        StorageManager.saveData('expenseData', data);
    }

    loadData() {
        const data = StorageManager.loadData('expenseData');
        if (data) {
            this.participants = data.participants || [];
            this.expenses = data.expenses || [];
            this.currency = data.currency || 'TWD';
            
            // 重新計算餘額
            this.calculateBalances();
        }
    }

    clearAllData() {
        this.participants = [];
        this.expenses = [];
        this.currency = 'TWD';
        StorageManager.clearData('expenseData');
    }
}

// UI 控制器
class UIController {
    constructor() {
        this.expenseManager = new ExpenseManager();
        this.init();
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 參與者姓名輸入框回車事件
        document.getElementById('participantName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAddParticipant();
            }
        });

        // 支出金額輸入框回車事件
        document.getElementById('expenseAmount').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAddExpense();
            }
        });
    }

    handleAddParticipant() {
        const nameInput = document.getElementById('participantName');
        const name = nameInput.value.trim();

        if (!name) {
            showToast('請輸入參與者姓名', 'error');
            return;
        }

        try {
            this.expenseManager.addParticipant(name);
            nameInput.value = '';
            this.updateUI();
            showToast(`已添加參與者：${name}`, 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    handleRemoveParticipant(id) {
        try {
            const participant = this.expenseManager.participants.find(p => p.id === id);
            this.expenseManager.removeParticipant(id);
            this.updateUI();
            showToast(`已移除參與者：${participant.name}`, 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    handleAddExpense() {
        const description = document.getElementById('expenseDescription').value;
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const paidBy = document.getElementById('expensePayer').value;
        const note = document.getElementById('expenseNote').value;

        try {
            this.expenseManager.addExpense(description, amount, paidBy, note);
            
            // 清空表單
            document.getElementById('expenseDescription').value = '';
            document.getElementById('expenseAmount').value = '';
            document.getElementById('expensePayer').value = '';
            document.getElementById('expenseNote').value = '';
            
            this.updateUI();
            showToast('支出記錄已添加', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    handleRemoveExpense(id) {
        this.expenseManager.removeExpense(id);
        this.updateUI();
        showToast('支出記錄已刪除', 'success');
    }

    updateUI() {
        this.renderParticipants();
        this.renderExpenses();
        this.updatePayerSelect();
        this.renderResults();
        this.updateCurrencyDisplay();
    }

    renderParticipants() {
        const container = document.getElementById('participantsList');
        const countElement = document.getElementById('participantCount');
        
        countElement.textContent = this.expenseManager.participants.length;
        
        if (this.expenseManager.participants.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="text-center opacity-50">
                        <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                        </svg>
                        <p>尚未添加參與者</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.expenseManager.participants.map(participant => `
            <div class="participant-card bg-base-200 p-3 rounded-lg flex items-center justify-between fade-in">
                <div class="flex items-center space-x-3">
                    <div class="avatar placeholder">
                        <div class="bg-primary text-primary-content rounded-full w-8 h-8">
                            <span class="text-xs">${participant.name.charAt(0)}</span>
                        </div>
                    </div>
                    <span class="font-medium">${participant.name}</span>
                </div>
                <button class="btn btn-ghost btn-sm text-error" onclick="uiController.handleRemoveParticipant('${participant.id}')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    renderExpenses() {
        const container = document.getElementById('expensesList');
        
        if (this.expenseManager.expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="text-center opacity-50">
                        <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                        <p>尚未添加支出記錄</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.expenseManager.expenses.map(expense => {
            const payer = this.expenseManager.participants.find(p => p.id === expense.paidBy);
            return `
                <div class="expense-item bg-base-200 p-3 rounded-lg fade-in">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center justify-between mb-1">
                                <h4 class="font-medium">${expense.description}</h4>
                                <span class="text-primary font-bold">${this.formatCurrency(expense.amount)}</span>
                            </div>
                            <div class="text-sm opacity-70">
                                付款人：${payer ? payer.name : '未知'}
                            </div>
                            ${expense.note ? `<div class="text-sm opacity-60 mt-1">備註：${expense.note}</div>` : ''}
                            <div class="text-xs opacity-50 mt-1">
                                ${new Date(expense.timestamp).toLocaleString('zh-TW')}
                            </div>
                        </div>
                        <button class="btn btn-ghost btn-sm text-error ml-2" onclick="uiController.handleRemoveExpense('${expense.id}')">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updatePayerSelect() {
        const select = document.getElementById('expensePayer');
        select.innerHTML = '<option value="">選擇付款人</option>';
        
        this.expenseManager.participants.forEach(participant => {
            select.innerHTML += `<option value="${participant.id}">${participant.name}</option>`;
        });
    }

    renderResults() {
        const resultsCard = document.getElementById('resultsCard');
        const transferCard = document.getElementById('transferCard');
        
        if (this.expenseManager.participants.length === 0 || this.expenseManager.expenses.length === 0) {
            resultsCard.style.display = 'none';
            transferCard.style.display = 'none';
            return;
        }

        resultsCard.style.display = 'block';
        
        // 計算總金額
        const totalExpense = this.expenseManager.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const perPersonAmount = totalExpense / this.expenseManager.participants.length;
        
        document.getElementById('totalExpense').textContent = this.formatCurrency(totalExpense);
        document.getElementById('perPersonAmount').textContent = this.formatCurrency(perPersonAmount);
        
        // 渲染餘額列表
        this.renderBalances();
        
        // 渲染轉帳建議
        this.renderTransferSuggestions();
    }

    renderBalances() {
        const container = document.getElementById('balancesList');
        
        container.innerHTML = this.expenseManager.participants.map(participant => {
            let statusClass = 'balance-zero';
            let statusText = '已結清';
            let statusIcon = '✅';
            
            if (participant.balance > 0.01) {
                statusClass = 'balance-positive';
                statusText = '應收';
                statusIcon = '💰';
            } else if (participant.balance < -0.01) {
                statusClass = 'balance-negative';
                statusText = '應付';
                statusIcon = '💸';
            }
            
            return `
                <div class="bg-base-200 p-3 rounded-lg slide-in">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="avatar placeholder">
                                <div class="bg-primary text-primary-content rounded-full w-8 h-8">
                                    <span class="text-xs">${participant.name.charAt(0)}</span>
                                </div>
                            </div>
                            <div>
                                <div class="font-medium">${participant.name}</div>
                                <div class="text-sm opacity-70">
                                    已付 ${this.formatCurrency(participant.totalPaid)} / 應付 ${this.formatCurrency(participant.shouldPay)}
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="flex items-center space-x-1">
                                <span>${statusIcon}</span>
                                <span class="text-sm opacity-70">${statusText}</span>
                            </div>
                            <div class="font-bold ${statusClass}">
                                ${this.formatCurrency(Math.abs(participant.balance))}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTransferSuggestions() {
        const transferCard = document.getElementById('transferCard');
        const container = document.getElementById('transfersList');
        
        // 創建參與者副本用於計算轉帳建議
        const participantsCopy = this.expenseManager.participants.map(p => ({...p}));
        const transfers = ExpenseManager.generateTransferSuggestions(participantsCopy);
        
        if (!transfers || transfers.length === 0) {
            transferCard.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        
        transferCard.style.display = 'block';
        
        container.innerHTML = transfers.map((transfer, index) => `
            <div class="transfer-suggestion bounce-in" style="animation-delay: ${index * 0.1}s">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="text-2xl">💳</div>
                        <div>
                            <div class="font-medium">
                                ${transfer.fromName} → ${transfer.toName}
                            </div>
                            <div class="text-sm opacity-80">
                                轉帳金額
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-xl font-bold">
                            ${this.formatCurrency(transfer.amount)}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateCurrencyDisplay() {
        document.getElementById('currentCurrency').textContent = this.expenseManager.currency;
    }

    formatCurrency(amount) {
        const symbols = {
            'TWD': 'NT$',
            'USD': '$',
            'JPY': '¥',
            'HKD': 'HK$',
            'CNY': '¥'
        };
        
        const symbol = symbols[this.expenseManager.currency] || this.expenseManager.currency;
        return `${symbol}${Math.abs(amount).toFixed(2)}`;
    }
}

// 全域函數
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const alert = toast.querySelector('.alert');
    
    toastMessage.textContent = message;
    
    // 移除舊的樣式類別
    alert.classList.remove('alert-success', 'alert-error', 'alert-warning', 'alert-info');
    
    // 添加新的樣式類別
    switch (type) {
        case 'error':
            alert.classList.add('alert-error');
            break;
        case 'warning':
            alert.classList.add('alert-warning');
            break;
        case 'info':
            alert.classList.add('alert-info');
            break;
        default:
            alert.classList.add('alert-success');
    }
    
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function showCurrencyModal() {
    document.getElementById('currencyModal').showModal();
}

function closeCurrencyModal() {
    document.getElementById('currencyModal').close();
}

function setCurrency() {
    const selectedCurrency = document.querySelector('input[name="currency"]:checked').value;
    uiController.expenseManager.setCurrency(selectedCurrency);
    uiController.updateUI();
    closeCurrencyModal();
    showToast(`貨幣已設定為 ${selectedCurrency}`, 'success');
}

function exportResults() {
    if (uiController.expenseManager.participants.length === 0) {
        showToast('沒有資料可以匯出', 'warning');
        return;
    }
    
    try {
        const content = ExportManager.exportToText(
            uiController.expenseManager.participants,
            uiController.expenseManager.expenses,
            uiController.expenseManager.currency
        );
        
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `分帳結果_${dateStr}.txt`;
        
        ExportManager.downloadFile(content, filename);
        showToast('分帳結果已匯出', 'success');
    } catch (error) {
        console.error('匯出失敗:', error);
        showToast('匯出失敗，請稍後再試', 'error');
    }
}

function clearAllData() {
    if (confirm('確定要清除所有資料嗎？此操作無法復原。')) {
        uiController.expenseManager.clearAllData();
        uiController.updateUI();
        showToast('所有資料已清除', 'success');
    }
}

function addParticipant() {
    uiController.handleAddParticipant();
}

function addExpense() {
    uiController.handleAddExpense();
}

let uiController;

function initializeApp() {
    uiController = new UIController();
}

window.onload = initializeApp;

// 將全域函式掛載到 window 物件，供 index.html 使用
window.showCurrencyModal = showCurrencyModal;
window.closeCurrencyModal = closeCurrencyModal;
window.setCurrency = setCurrency;
window.exportResults = exportResults;
window.clearAllData = clearAllData;
window.addParticipant = addParticipant;
window.addExpense = addExpense;

// 匯出類別供其他模組使用
export { ExpenseManager, UIController, StorageManager, ExportManager };
