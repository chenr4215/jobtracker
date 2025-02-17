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

// 添加职位（新增文件上传功能）
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
    const fileInput = document.getElementById("jobFile");
    let file = fileInput.files[0];

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
        note: jobNote,           // 备注/标签字段
        status: "applied"
    };

    // 如果选择了文件，则上传到 Firebase Storage
    if (file) {
        try {
            const storage = firebaseApp.storage;
            const fileRef = firebaseApp.storageRef(storage, `jobs/${user.uid}/${newJob.id}/${file.name}`);
            await firebaseApp.uploadBytes(fileRef, file);
            const downloadURL = await firebaseApp.getDownloadURL(fileRef);
            newJob.attachment = downloadURL;
        } catch (error) {
            console.error("文件上传失败:", error);
            alert("文件上传失败！");
        }
    }

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

// 刷新职位表格（包含附件预览）
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
                <td>${job.attachment ? `<a href="${job.attachment}" target="_blank">预览</a>` : ""}</td>
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

// 清空输入框（包括文件输入）
function clearInputs() {
    document.getElementById("jobTitle").value = "";
    document.getElementById("company").value = "";
    document.getElementById("location").value = "";
    document.getElementById("date").value = new Date().toISOString().split("T")[0];
    document.getElementById("jobNote").value = "";
    document.getElementById("jobFile").value = "";
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
  csvContent += "职位名称,公司,地点,申请日期,备注/标签,附件,状态\n";
  
  data.forEach(job => {
    // 构造一行数据，使用双引号包裹每个字段，避免逗号冲突
    let row = [
      job.title, 
      job.company, 
      job.location, 
      job.date, 
      job.note || "",
      job.attachment ? "附件已上传" : "",
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


// 存储离线新增的职位
let offlineJobs = []; 

// 启动时尝试从 localStorage 读取数据
window.addEventListener('load', () => {
  loadLocalData();
  checkOnlineStatus();
});

// 监听网络状态
window.addEventListener('online', () => {
  console.log('网络恢复在线');
  syncOfflineJobs();  // 同步离线新增的职位到 Firebase
  loadJobs(firebaseApp.auth.currentUser?.uid); // 重新加载最新职位数据
});

window.addEventListener('offline', () => {
  console.log('当前处于离线状态');
});

// ----------------------
// 1. 本地存储相关函数
// ----------------------
function saveLocalData() {
  // 将 allJobs 和 offlineJobs 都存到 localStorage
  localStorage.setItem('allJobs', JSON.stringify(allJobs));
  localStorage.setItem('offlineJobs', JSON.stringify(offlineJobs));
}

function loadLocalData() {
  // 从 localStorage 加载
  const storedAllJobs = localStorage.getItem('allJobs');
  const storedOfflineJobs = localStorage.getItem('offlineJobs');

  if (storedAllJobs) {
    allJobs = JSON.parse(storedAllJobs);
    jobs = allJobs.slice(); // 复制给 jobs
    refreshTable();
  }

  if (storedOfflineJobs) {
    offlineJobs = JSON.parse(storedOfflineJobs);
  }
}

// ----------------------
// 2. 检查网络状态
// ----------------------
function checkOnlineStatus() {
  if (navigator.onLine) {
    console.log("当前在线");
  } else {
    console.log("当前离线");
  }
}

// ----------------------
// 3. 离线时新增职位
// ----------------------
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
  const fileInput = document.getElementById("jobFile");
  let file = fileInput.files[0];

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
    note: jobNote,
    status: "applied"
    // attachment: 等待上传
  };

  // 如果选择了文件，需要处理文件上传
  // 若离线，无法上传 => 这里仅演示记录文件名
  if (file) {
    newJob.attachmentName = file.name;
  }

  // 如果当前在线，直接走原逻辑
  if (navigator.onLine) {
    try {
      // 先上传附件 => 省略
      // 再写入 Firebase
      await firebaseApp.set(
        firebaseApp.ref(firebaseApp.db, `jobs/${user.uid}/${newJob.id}`),
        newJob
      );
      console.log("职位添加成功:", newJob);
      loadJobs(user.uid); // 重新从 Firebase 获取最新数据
    } catch (error) {
      console.error("数据保存失败:", error);
    }
  } else {
    // 如果离线，先存到 offlineJobs，等网络恢复后再统一同步
    offlineJobs.push(newJob);
    allJobs.push(newJob);
    jobs = allJobs.slice();
    refreshTable();
    console.log("当前离线，已暂存职位:", newJob);
    saveLocalData(); // 更新 localStorage
  }

  clearInputs();
}

// ----------------------
// 4. 同步离线职位到 Firebase
// ----------------------
async function syncOfflineJobs() {
  const user = firebaseApp.auth.currentUser;
  if (!user || offlineJobs.length === 0) return;

  console.log("开始同步离线职位:", offlineJobs);
  for (let job of offlineJobs) {
    try {
      // 如果 job.attachmentName 存在，说明有文件要上传
      // 这里略去演示，需要自己写 upload 逻辑
      await firebaseApp.set(
        firebaseApp.ref(firebaseApp.db, `jobs/${user.uid}/${job.id}`),
        job
      );
      console.log("离线职位同步成功:", job);
    } catch (error) {
      console.error("离线职位同步失败:", error);
    }
  }

  // 同步完成后清空 offlineJobs
  offlineJobs = [];
  saveLocalData();
  console.log("离线职位全部同步完成");
}

// ----------------------
// 5. 从 Firebase 加载职位
// ----------------------
function loadJobs(userId) {
  if (!userId) return;
  const jobsRef = firebaseApp.ref(firebaseApp.db, `jobs/${userId}`);
  firebaseApp.onValue(jobsRef, (snapshot) => {
    const data = snapshot.val();
    allJobs = data ? Object.values(data) : [];
    jobs = allJobs.slice();
    console.log("加载职位数据:", jobs);
    refreshTable();
    saveLocalData(); // 每次获取最新数据后，也保存一份到本地
  });
}
