let jobs = [];
let allJobs = []; // 保存原始数据备份
let sortField = null;
let sortDirection = 'asc';

// 页面加载时初始化
window.onload = () => {
    console.log("页面加载完成");
    document.getElementById("date").value = new Date().toISOString().split("T")[0];

    if (window.firebaseApp && window.firebaseApp.auth) {
        initializeAuthListener();
    } else {
        console.error("Firebase 未正确加载！");
    }
};

// 监听用户登录状态
function initializeAuthListener() {
    firebaseApp.auth.onAuthStateChanged((user) => {
        console.log("用户状态变化:", user);
        if (user) {
            document.getElementById("loginBtn").style.display = "none";
            document.getElementById("logoutBtn").style.display = "block";
            document.getElementById("userInfo").style.display = "inline";
            document.getElementById("userInfo").textContent = `欢迎，${user.displayName || user.email}`;
            loadJobs(user.uid);
        } else {
            document.getElementById("loginBtn").style.display = "block";
            document.getElementById("logoutBtn").style.display = "none";
            document.getElementById("userInfo").style.display = "none";
            jobs = [];
            allJobs = [];
            refreshTable();
        }
    });
}

// 从 Firebase 加载职位数据
function loadJobs(userId) {
    const jobsRef = firebaseApp.ref(firebaseApp.db, `jobs/${userId}`);
    firebaseApp.onValue(jobsRef, (snapshot) => {
        const data = snapshot.val();
        allJobs = data ? Object.values(data) : [];
        jobs = allJobs;
        console.log("加载职位数据:", jobs);
        refreshTable();
    });
}

// Google 登录
async function loginWithGoogle() {
    try {
        const result = await firebaseApp.signInWithPopup(firebaseApp.auth, firebaseApp.provider);
        console.log("登录成功:", result.user);
    } catch (error) {
        console.error("登录失败:", error.message);
        alert("登录失败，请检查控制台！");
    }
}

// 注销
async function logout() {
    try {
        await firebaseApp.signOut(firebaseApp.auth);
        console.log("用户已注销");
    } catch (error) {
        console.error("注销失败:", error);
    }
}

// 添加职位（增加备注字段）
async function addJob() {
    const user = firebaseApp.auth.currentUser;
    if (!user) {
        alert("请先登录！");
        return;
    }

    const jobTitle = document.getElementById("jobTitle").value;
    const company = document.getElementById("company").value;
    const location = document.getElementById("location").value;
    const date = document.getElementById("date").value || new Date().toISOString().split("T")[0];
    const jobNote = document.getElementById("jobNote").value;

    if (!jobTitle || !company) {
        alert("职位名称和公司名称不能为空！");
        return;
    }

    const newJob = {
        id: Date.now(),
        title: jobTitle,
        company: company,
        location: location || "未知",
        date: date,
        note: jobNote,           // 新增备注字段
        status: "applied"
    };

    try {
        await firebaseApp.set(
            firebaseApp.ref(firebaseApp.db, `jobs/${user.uid}/${newJob.id}`),
            newJob
        );
        console.log("职位添加成功:", newJob);
        clearInputs();
        // 数据更新由 Firebase onValue 自动刷新
    } catch (error) {
        console.error("数据保存失败:", error);
    }
}

// 刷新职位表格（新增备注列）
function refreshTable() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = jobs
        .map(
            (job) => `
            <tr>
                <td>${job.title}</td>
                <td>${job.company}</td>
                <td>${job.location}</td>
                <td>${job.date}</td>
                <td>${job.note || ""}</td>
                <td>
                    <button class="status-btn ${job.status}" onclick="changeStatus('${job.id}')">
                        ${getStatusText(job.status)}
                    </button>
                </td>
                <td>
                    <button onclick="deleteJob('${job.id}')">🗑️ 删除</button>
                </td>
            </tr>`
        )
        .join("");
}

// 切换职位状态
async function changeStatus(jobId) {
    const user = firebaseApp.auth.currentUser;
    if (!user) return;

    const job = jobs.find((j) => j.id === Number(jobId));
    const statusOrder = ["applied", "interview", "rejected", "accepted"];
    const currentIndex = statusOrder.indexOf(job.status);
    job.status = statusOrder[(currentIndex + 1) % statusOrder.length];

    try {
        await firebaseApp.update(
            firebaseApp.ref(firebaseApp.db, `jobs/${user.uid}/${jobId}`),
            { status: job.status }
        );
        console.log("状态更新成功:", jobId, job.status);
        // 更新由 Firebase 自动刷新
    } catch (error) {
        console.error("状态更新失败:", error);
    }
}

// 删除职位
async function deleteJob(jobId) {
    const user = firebaseApp.auth.currentUser;
    if (!user) return;

    try {
        await firebaseApp.remove(
            firebaseApp.ref(firebaseApp.db, `jobs/${user.uid}/${jobId}`)
        );
        console.log("职位删除成功:", jobId);
        // 更新由 Firebase 自动刷新
    } catch (error) {
        console.error("删除失败:", error);
    }
}

// 辅助函数：返回状态文本
function getStatusText(status) {
    const statusMap = {
        applied: "已申请",
        interview: "面试邀请",
        rejected: "已拒绝",
        accepted: "已接受",
    };
    return statusMap[status];
}

// 清空输入框（新增备注清空）
function clearInputs() {
    document.getElementById("jobTitle").value = "";
    document.getElementById("company").value = "";
    document.getElementById("location").value = "";
    document.getElementById("date").value = new Date().toISOString().split("T")[0];
    document.getElementById("jobNote").value = "";
}

// 导出职位数据为 CSV 格式
function exportData() {
  // 使用 allJobs 导出所有职位数据（如果希望导出当前过滤结果，可使用 jobs 数组）
  let data = allJobs;
  if (!data || data.length === 0) {
    alert("没有职位数据可导出！");
    return;
  }
  
  // CSV 文件内容，包含标题行
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "职位名称,公司,地点,申请日期,备注/标签,状态\n";
  
  data.forEach(job => {
    // 构造一行数据，使用双引号包裹每个字段，避免逗号冲突
    let row = [
      job.title, 
      job.company, 
      job.location, 
      job.date, 
      job.note || "",
      getStatusText(job.status)
    ].map(item => `"${item}"`).join(",");
    csvContent += row + "\n";
  });
  
  // 编码并创建一个隐藏的下载链接
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "jobs_export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 搜索功能（使用 allJobs 备份数据过滤，不直接修改原始数据）
document.getElementById("search").addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase();
    if (!keyword) {
        jobs = allJobs;
        refreshTable();
        return;
    }
    jobs = allJobs.filter(
        (job) =>
            job.title.toLowerCase().includes(keyword) ||
            job.company.toLowerCase().includes(keyword)
    );
    refreshTable();
});

// 排序功能及动态箭头更新
function sortTable(field) {
    if (sortField === field) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
        sortField = field;
        sortDirection = "asc";
    }

    jobs.sort((a, b) => {
        let valueA = a[field];
        let valueB = b[field];

        if (field === "date") {
            valueA = new Date(valueA).getTime();
            valueB = new Date(valueB).getTime();
            return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
        } else {
            valueA = String(valueA).toLowerCase();
            valueB = String(valueB).toLowerCase();
            if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
            if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
            return 0;
        }
    });

    refreshTable();
    updateSortArrows();
}

// 更新排序箭头显示
function updateSortArrows() {
    const arrowUp = "↑";
    const arrowDown = "↓";
    const arrowNeutral = "↕";

    document.getElementById("sortTitle").textContent = arrowNeutral;
    document.getElementById("sortCompany").textContent = arrowNeutral;
    document.getElementById("sortLocation").textContent = arrowNeutral;
    document.getElementById("sortDate").textContent = arrowNeutral;

    switch (sortField) {
        case "title":
            document.getElementById("sortTitle").textContent = sortDirection === "asc" ? arrowUp : arrowDown;
            break;
        case "company":
            document.getElementById("sortCompany").textContent = sortDirection === "asc" ? arrowUp : arrowDown;
            break;
        case "location":
            document.getElementById("sortLocation").textContent = sortDirection === "asc" ? arrowUp : arrowDown;
            break;
        case "date":
            document.getElementById("sortDate").textContent = sortDirection === "asc" ? arrowUp : arrowDown;
            break;
    }
}
