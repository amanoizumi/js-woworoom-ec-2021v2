import { apiPath, myPath, token } from "./config.js";
import { showSuccess, showError } from "./function.js";
import "./admin-animation.js";

// DOM
const orderBody = document.querySelector(".order-body");
const sortOrder = document.querySelector("#sortOrder");
const discardAllBtn = document.querySelector(".discardAllBtn");

let ordersData = [];

// C3.js
function renderC3() {
  if (ordersData.length === 0) {
    c3.generate({
      bindto: "#chart",
      data: {
        type: "pie",
        columns: [["目前沒有訂單", 1]],
        colors: { 目前沒有訂單: "#888888" },
      },
    });
  } else {
    const obj = {};

    // 算出某項產品總營收
    ordersData.forEach((order) => {
      order.products.forEach((product) => {
        if (obj[product.title] === undefined) {
          obj[product.title] = product.quantity * product.price;
        } else {
          obj[product.title] += product.quantity * product.price;
        }
      });
    });

    const objKeys = Object.keys(obj);
    const objValues = Object.values(obj);

    let arr = [];
    objKeys.forEach((item, idx) => {
      arr.push([objKeys[idx], objValues[idx]]);
    });

    // 由最大排到最小
    arr.sort((a, b) => b[1] - a[1]);

    // 分配顏色
    const colorsArr = ["#301E5F", "#5434A7", "#9D7FEA", "#DACBFF"];
    const colors = {};
    const arrLen = arr.length;

    // 品項大於三個時，把除了營收前三高的，都歸類為「其他」
    if (arrLen > 3) {
      const arrSpliced = arr.splice(3);

      let another = 0;
      arrSpliced.forEach((item) => (another += item[1]));
      arr.push(["其他", another]);

      arr.forEach((item, idx) => {
        colors[item[0]] = colorsArr[idx];
      });
    } else if (arrLen <= 3) {
      arr.forEach((item, idx) => {
        colors[item[0]] = colorsArr[idx];
      });
    }

    c3.generate({
      bindto: "#chart",
      data: {
        type: "pie",
        columns: arr,
        colors: colors,
      },
    });
  }
}

// 取得訂單列表
function getOrderList() {
  const url = `${apiPath}/admin/${myPath}/orders`;
  axios
    .get(url, token)
    .then((res) => {
      ordersData = res.data.orders;
      renderC3();
      renderOrder();
    })
    .catch((err) => {
      showError(err);
    });
}

// 渲染訂單
function renderOrder(data = ordersData) {
  if (data.length === 0) {
    orderBody.innerHTML = '<tr><td colspan="8" class="text-center">當前項目沒有訂單</td></tr>';
  } else {
    sortOrders(data);
    let template = "";
    data.forEach((item) => {
      let productsStr = "";
      item.products.forEach((product) => {
        productsStr += `<li>${product.title} X ${product.quantity}</li>`;
      });

      template += `<tr>
      <td>${item.createdAt}</td>
      <td>
        <p>${item.user.name}</p>
        <p>${item.user.tel}</p>
      </td>
      <td>${item.user.address}</td>
      <td>${item.user.email}</td>
      <td>
        <ul>${productsStr}</ul>
      </td>
      <td>${calcOrderDay(item.createdAt)}</td>
      <td class="orderStatus">
        <a href="#" data-id="${item.id}" data-js="edit" data-paid="${item.paid}">${
        item.paid ? "已處理" : "未處理"
      }</a>
      </td>
      <td>
        <input type="button" class="delSingleOrder-Btn" value="刪除" data-order="${
          item.createdAt
        }" data-js="delete" data-id="${item.id}"/>
      </td>
    </tr>`;
    });
    orderBody.innerHTML = template;
  }
}

// 按照時間先後排列訂單，最舊的優先處理
function sortOrders(data = ordersData) {
  data.sort((a, b) => a.createdAt - b.createdAt);
}

// 秒轉換成日期字串
function calcOrderDay(num) {
  // UNIX 的時間戳記是毫秒，先把秒轉成毫秒
  num = num * 1000;
  const date = new Date(num);

  const yearStr = date.getFullYear();
  const monthStr = date.getMonth() + 1;
  const dateStr = date.getDate();

  if (monthStr < 10) {
    monthStr = "0" + monthStr;
  }
  if (dateStr < 10) {
    dateStr = "0" + dateStr;
  }

  const str = `${yearStr}/${monthStr}/${dateStr}`;
  return str;
}

// 篩選訂單
function orderSelect(e) {
  const str = e.target.value;
  if (str === "全部") {
    renderOrder();
  } else if (str === "未處理") {
    const renderData = ordersData.filter((item) => !item.paid);
    renderOrder(renderData);
  } else if (str === "已處理") {
    const renderData = ordersData.filter((item) => item.paid);
    renderOrder(renderData);
  }
}
sortOrder.addEventListener("change", orderSelect);

// 監聽訂單行為
function orderHandler(e) {
  e.preventDefault();
  const doSomething = e.target.dataset.js;
  if (doSomething === undefined) return;
  else if (doSomething === "edit") {
    editOrder(e);
  } else if (doSomething === "delete") {
    deleteOrder(e);
  }
}

// 刪除訂單
function deleteOrder(e) {
  const { id } = e.target.dataset;
  const { order } = e.target.dataset;
  Swal.fire({
    title: `確定要刪除訂單 ${order} 嗎？`,
    confirmButtonColor: "#6A33F8",
    confirmButtonText: "確認",
    cancelButtonText: "取消",
    showCancelButton: true,
    icon: "warning",
  }).then((result) => {
    if (result.isConfirmed) {
      axios
        .delete(`${apiPath}/admin/${myPath}/orders/${id}`, token)
        .then((res) => {
          res.data.orders;
          ordersData = res.data.orders;
          renderOrder();
          renderC3();
          sortOrder.value = "全部";
          showSuccess(`成功刪除訂單 ${order}！`);
        })
        .catch((err) => {
          showError(err);
        });
    }
  });
}

// 編輯訂單
function editOrder(e) {
  const { id } = e.target.dataset;
  let { paid } = e.target.dataset;
  if (paid === "false") {
    paid = false;
  } else if (paid === "true") {
    paid = true;
  }
  const obj = {
    data: {
      id,
      paid: !paid,
    },
  };
  axios
    .put(`${apiPath}/admin/${myPath}/orders`, obj, token)
    .then((res) => {
      ordersData = res.data.orders;
      renderOrder();
      renderC3();
      sortOrder.value = "全部";
      showSuccess("訂單狀態修改完成");
    })
    .catch((err) => {
      showError(err);
    });
}
orderBody.addEventListener("click", orderHandler);

// 刪除全部訂單
function deleteAllOrders() {
  if (ordersData.length === 0) {
    Swal.fire({
      title: "目前沒有任何訂單",
      icon: "warning",
    });
  } else {
    Swal.fire({
      title: "確定要刪除所有訂單嗎？",
      confirmButtonColor: "#6A33F8",
      confirmButtonText: "確認",
      cancelButtonText: "取消",
      showCancelButton: true,
      icon: "warning",
    }).then((result) => {
      if (result.isConfirmed) {
        axios
          .delete(`${apiPath}/admin/${myPath}/orders`, token)
          .then((res) => {
            ordersData = res.data.orders;
            sortOrder.value = "全部";
            renderOrder();
            renderC3();
            showSuccess("已刪除所有訂單！");
          })
          .catch((err) => {
            showError(err);
          });
      }
    });
  }
}
discardAllBtn.addEventListener("click", deleteAllOrders);

getOrderList();
