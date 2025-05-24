import { useState, useEffect } from "react";
import Head from "next/head";
import TaskStatus from "../components/TaskStatus";
import TaskControls from "../components/TaskControls";
import EnhancedKeywordManager from "../components/EnhancedKeywordManager";
import LocalStorageMonitor from "../components/LocalStorageMonitor";

export default function TaskControl() {
  const [status, setStatus] = useState({ status: "loading", running: false });
  const [scrapeSpeed, setScrapeSpeed] = useState("normal"); // 默认使用正常速度
  const [keywords, setKeywords] = useState([
    "javascript",
    "nodejs",
    "frontend",
    "react",
    "web developer",
    "fullstack",
    "typescript",
    "vue",
    "angular",
    "nextjs",
    "nuxtjs",
    "svelte",
    "ember.js",
    "extjs",
    "html css",
    "tailwind",
    "bootstrap",
  ]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);

  // 处理任务状态更新
  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
  };

  // 初始加载时获取关键词
  useEffect(() => {
    // 加载关键词
    const fetchKeywords = async () => {
      try {
        const res = await fetch("/api/task/keywords");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.keywords)) {
            setKeywords(data.keywords);
            // 默认选择所有关键词
            setSelectedKeywords(data.keywords);
          }
        }
      } catch (error) {
        console.error("获取关键词失败:", error);
        // 如果获取失败，默认选择所有预设关键词
        setSelectedKeywords([...keywords]);
      }
    };

    fetchKeywords();
  }, []);

  useEffect(() => {
    // 初始化SSE连接 - 添加自动重连逻辑
    let eventSource = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 2000; // 2秒

    const connectSSE = () => {
      console.log("建立状态更新连接...");
      eventSource = new EventSource("/api/task/sse");

      eventSource.onmessage = (event) => {
        try {
          const newStatus = JSON.parse(event.data);
          console.log("收到状态更新:", newStatus);

          // 状态变化监控
          if (
            status.status !== newStatus.status ||
            status.running !== newStatus.running
          ) {
            console.log(
              "状态发生变化!",
              `之前: [status=${status.status}, running=${status.running}]`,
              `现在: [status=${newStatus.status}, running=${newStatus.running}]`
            );
          }

          // 重要: 更新状态
          handleStatusChange(newStatus);

          // 重置重连尝试次数
          reconnectAttempts = 0;
        } catch (error) {
          console.error("解析状态更新失败:", error, event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error("状态更新连接错误:", error);
        eventSource.close();

        // 尝试重连
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(
            `尝试重新连接... (${reconnectAttempts}/${maxReconnectAttempts})`
          );
          setTimeout(connectSSE, reconnectDelay);
        } else {
          console.error(
            `已达到最大重连次数 (${maxReconnectAttempts})，停止尝试`
          );
        }
      };

      eventSource.onopen = () => {
        console.log("状态更新连接已建立");
        // 重置重连尝试次数
        reconnectAttempts = 0;
      };
    };

    // 建立初始连接
    connectSSE();

    return () => {
      console.log("关闭状态更新连接");
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // 监视状态变化
  useEffect(() => {
    console.log("状态已更新:", status);
  }, [status]);

  const handleStart = async () => {
    try {
      // 验证是否选择了关键词
      if (selectedKeywords.length === 0) {
        alert("请至少选择一个关键词进行抓取");
        return;
      }

      console.log("发送启动任务请求...");

      // 立即更新状态，不等待响应
      console.log("预先更新状态为running...");
      setStatus((prev) => ({
        ...prev,
        status: "running",
        running: true,
      }));

      console.log("状态更新后:", status); // 这里打印的可能是旧状态，因为setState是异步的

      const response = await fetch("/api/task/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keywords: selectedKeywords, // 只发送选中的关键词
          scrapeSpeed, // 发送抓取速度设置
        }),
      });

      const data = await response.json();
      console.log("启动任务响应:", data);

      if (!response.ok) {
        console.error("启动任务失败:", data.error);

        // 恢复到原状态
        setStatus((prev) => ({
          ...prev,
          status: "stopped",
          running: false,
        }));

        throw new Error("启动任务失败");
      }

      // 使用响应数据更新状态（如果后端发送了任何额外数据）
      setStatus((prev) => ({
        ...prev,
        status: data.status || "running",
        running: true,
        lastError: null,
      }));

      // 强制刷新
      setTimeout(() => {
        console.log("强制检查状态更新:", status);
      }, 100);
    } catch (error) {
      console.error("启动任务错误:", error);

      // 确保状态恢复到停止
      setStatus((prev) => ({
        ...prev,
        status: "stopped",
        running: false,
        lastError: error.message,
      }));
    }
  };

  const handlePause = async () => {
    try {
      console.log("发送暂停任务请求...");

      // 立即更新前端状态
      console.log("预先更新状态为paused...");
      setStatus((prev) => ({
        ...prev,
        status: "paused",
        running: false,
      }));

      const response = await fetch("/api/task/pause", {
        method: "POST",
      });

      const data = await response.json();
      console.log("暂停任务响应:", data);

      if (!response.ok) {
        console.error("暂停任务失败:", data.error);

        // 恢复到原状态
        setStatus((prev) => ({
          ...prev,
          status: "running",
          running: true,
        }));

        throw new Error("暂停任务失败");
      }

      // 确保状态最终与服务器响应一致
      setStatus((prev) => ({
        ...prev,
        status: data.status || "paused",
        running: false,
      }));
    } catch (error) {
      console.error("暂停任务错误:", error);
    }
  };

  const handleResume = async () => {
    try {
      console.log("发送恢复任务请求...");

      // 立即更新前端状态
      console.log("预先更新状态为running...");
      setStatus((prev) => ({
        ...prev,
        status: "running",
        running: true,
      }));

      const response = await fetch("/api/task/resume", {
        method: "POST",
      });

      const data = await response.json();
      console.log("恢复任务响应:", data);

      if (!response.ok) {
        console.error("恢复任务失败:", data.error);

        // 恢复到原状态
        setStatus((prev) => ({
          ...prev,
          status: "paused",
          running: false,
        }));

        throw new Error("恢复任务失败");
      }

      // 确保状态最终与服务器响应一致
      setStatus((prev) => ({
        ...prev,
        status: data.status || "running",
        running: true,
      }));
    } catch (error) {
      console.error("恢复任务错误:", error);
    }
  };

  const handleStop = async () => {
    try {
      console.log("发送停止任务请求...");

      // 立即更新前端状态
      console.log("预先更新状态为stopped...");
      setStatus((prev) => ({
        ...prev,
        status: "stopped",
        running: false,
      }));

      const response = await fetch("/api/task/stop", {
        method: "POST",
      });

      const data = await response.json();
      console.log("停止任务响应:", data);

      if (!response.ok) {
        console.error("停止任务失败:", data.error);

        // 恢复到原状态（取决于停止前的状态）
        setStatus((prev) => ({
          ...prev,
          status: prev.status, // 保持原来的状态
          running: prev.running,
        }));

        throw new Error("停止任务失败");
      }

      // 确保状态重置
      setStatus((prev) => ({
        ...prev,
        status: "stopped",
        running: false,
        geoId: "",
        keyword: "",
        step: 0,
        geoIndex: 0,
        keywordIndex: 0,
        startedAt: null,
        elapsedSec: 0,
        lastBatchCount: 0,
        lastError: null,
      }));
    } catch (error) {
      console.error("停止任务错误:", error);
    }
  };

  const handleKeywordsUpdate = async (newKeywords) => {
    try {
      const response = await fetch("/api/task/keywords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keywords: newKeywords }),
      });

      if (!response.ok) {
        throw new Error("更新关键词失败");
      }

      setKeywords(newKeywords);
      
      // 更新选中状态，保留仍然存在的关键词的选中状态
      const newSelected = selectedKeywords.filter(keyword => newKeywords.includes(keyword));
      setSelectedKeywords(newSelected);
    } catch (error) {
      console.error("更新关键词错误:", error);
    }
  };

  const handleKeywordSelectionChange = (newSelectedKeywords) => {
    setSelectedKeywords(newSelectedKeywords);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Head>
        <title>远程岗位抓取任务控制</title>
        <meta name="description" content="控制远程岗位自动抓取任务" />
      </Head>

      <header className="bg-white shadow-sm py-5">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex center items-center gap-4">
            <h1 className="text-2xl font-bold text-indigo-600">
              远程岗位抓取任务控制
            </h1>
            <div className="flex gap-2">
              <div
                className={`px-3 py-1 inline-block rounded-full text-sm font-medium ${
                  status.running
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : status.status === "paused"
                    ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                    : "bg-gray-100 text-gray-800 border border-gray-200"
                }`}
              >
                任务状态: <span className="font-bold">{status.status}</span>
                {status.running && <span className="ml-1 animate-pulse">●</span>}
              </div>
              <div className="px-3 py-1 inline-block rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                关键词: <span className="font-bold">{selectedKeywords.length}/{keywords.length}</span> 已启用
              </div>
            </div>
          </div>
          {/* 任务控制卡片 */}
          <div>
            <TaskControls
              status={status}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto py-5 px-4 flex flex-col">
        {/* 速度设置选择器 */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-800">
            抓取速度设置
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setScrapeSpeed("fast")}
              className={`px-4 py-2 rounded-md ${
                scrapeSpeed === "fast"
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              快速模式
              <span className="block text-xs mt-1">
                {scrapeSpeed === "fast" ? "当前选择" : "速度最快，风险较高"}
              </span>
            </button>

            <button
              onClick={() => setScrapeSpeed("normal")}
              className={`px-4 py-2 rounded-md ${
                scrapeSpeed === "normal"
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              正常模式
              <span className="block text-xs mt-1">
                {scrapeSpeed === "normal" ? "当前选择" : "平衡速度与安全"}
              </span>
            </button>

            <button
              onClick={() => setScrapeSpeed("safe")}
              className={`px-4 py-2 rounded-md ${
                scrapeSpeed === "safe"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              安全模式
              <span className="block text-xs mt-1">
                {scrapeSpeed === "safe" ? "当前选择" : "速度最慢，最不易被封"}
              </span>
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            {scrapeSpeed === "fast" &&
              "快速模式：每个职位间隔50-100ms，页面加载后等待20-50ms。处理速度最快，但可能增加被LinkedIn限制的风险。"}
            {scrapeSpeed === "normal" &&
              "正常模式：每个职位间隔200-400ms，页面加载后等待100-200ms。平衡了速度和安全性。"}
            {scrapeSpeed === "safe" &&
              "安全模式：每个职位间隔500-1000ms，页面加载后等待200-400ms。速度较慢，但更不易被LinkedIn识别为爬虫。"}
          </p>
        </div>

        {/* 状态显示区域 */}
        <TaskStatus status={status} onStatusChange={handleStatusChange} />

        <div className="flex flex-col lg:flex-row gap-8">
          {/* 左列：本地存储监控 */}
          <div className="lg:w-1/3 space-y-8">
            {/* 本地存储监控 */}
            <LocalStorageMonitor />
          </div>

          {/* 右列：关键词管理 */}
          <div className="lg:w-2/3 flex flex-col h-full space-y-8">
            {/* 增强版关键词管理区域 */}
            <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col flex-grow">
              <EnhancedKeywordManager
                keywords={keywords}
                selectedKeywords={selectedKeywords}
                onUpdate={handleKeywordsUpdate}
                onSelectionChange={handleKeywordSelectionChange}
              />
            </div>
          </div>
        </div>

        {/* 重试提示 - 当有重试操作时显示 */}
        {status.lastError && status.lastError.includes("重试") && (
          <div className="mt-4 p-4 border border-yellow-300 bg-yellow-50 rounded-lg text-yellow-800">
            <div className="flex items-start">
              <svg
                className="w-6 h-6 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <div>
                <h3 className="font-semibold mb-1">系统正在自动重试</h3>
                <p className="text-sm">{status.lastError}</p>
                <p className="text-sm mt-2">
                  您可以随时点击"停止任务"按钮终止自动重试。
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
