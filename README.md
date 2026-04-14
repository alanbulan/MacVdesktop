# MacVdesktop

MacVdesktop 是一个面向 **Apple Silicon / macOS** 的原生遥测桌面舱项目。

它的目标不是做“看起来很像遥测”的视觉包装，而是在桌面壳层内建立一条**可追溯、可验证、可扩展**的宿主采集链路：

- 有真实数据，就展示真实数据。
- 暂时采不到，就明确展示 `unavailable` / `loading` / `error`。
- 不用估算值、演示值、伪造值去填补视觉空洞。

这条约束不是文案风格，而是工程边界。

---

## 项目定位

当前仓库聚焦两个方向：

1. **原生遥测宿主能力**：通过 Tauri v2 + Rust 建立桌面命令边界，把宿主指标安全地送到前端。
2. **高密度可视化表达**：在 React 界面中呈现“原生遥测舱”视图，但始终服从真实性约束，不为了画面完整而牺牲数据语义。

如果一个指标当前无法被真实、稳定、可解释地采集，那么它在界面上就应该被诚实地标记为不可用，而不是被补成“看起来合理”的数值。

---

## 当前能力边界

### 运行模式

| 运行模式 | 当前行为 | 说明 |
| --- | --- | --- |
| 浏览器开发模式（Windows / Linux / 任意非 Tauri 环境） | 渲染完整遥测舱 UI，但原生宿主指标以不可用/回退状态呈现 | 只验证界面与前端逻辑，不伪造宿主数据 |
| Tauri 桌面宿主 | 通过原生命令返回遥测快照 | 用于真实宿主数据采集与界面联动 |

### 已实现的宿主指标

在当前原生宿主链路中，已具备或部分具备以下能力：

- **CPU Cluster**：CPU 使用率
- **Memory Pressure**：内存占用与压力态势
- **Disk Usage**：磁盘容量与空闲空间
- **Network Throughput**：网络吞吐采样
- **Top Process**：高 CPU 进程识别
- **Thermal State**：基于 macOS `NSProcessInfo.thermalState` 的热状态采样
- **Fan Speed**：基于 `powermetrics` SMC 输出的尽力采样
- **Power Draw**：基于 `powermetrics` 的功耗尽力采样

### 仍然刻意保守的部分

以下能力没有被“美化完成”，而是被保留在真实边界内：

- **GPU Activity**：当前不把 GPU 功耗误写成 GPU 活跃度。
- 如果宿主只能拿到功耗旁路信息，而拿不到可信的系统级 GPU 活跃度计数器，那么主指标仍保持 `unavailable`。
- 对于需要更强 Metal 计数器路径或 app-owned collector 的能力，仓库会优先保证**语义正确**，再谈视觉完整。

---

## 技术栈

### 前端

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Vitest + Testing Library

### 桌面宿主

- Tauri v2
- Rust
- `sysinfo`
- macOS Foundation / Metal 相关原生接口
- `powermetrics`（用于部分尽力型采样）

---

## 架构概览

当前工程采用一条比较清晰的分层：

### 1. 表现层

`src/components/*`

负责遥测舱界面、模块卡片、指标面板、巡检角色与视觉编排。

### 2. 领域层

`src/domain/telemetry/*`

负责定义快照结构、浏览器回退快照、历史样本、布局常量与摘要逻辑。这里是“数据该长什么样”的地方，不掺杂宿主调用细节。

### 3. 集成层

`src/integrations/telemetry/*`

通过 provider 模式分离浏览器回退实现与 Tauri 宿主实现：

- 浏览器环境：返回明确的回退快照
- Tauri 环境：通过 `invoke('get_telemetry_snapshot')` 获取原生快照

### 4. 原生宿主层

`src-tauri/src/telemetry.rs`

负责真正的宿主数据采集、指标组装与状态降级。这里决定：

- 哪些数据可以被视为 live
- 哪些数据必须是 unavailable
- 告警阈值如何解释
- 原生失败如何被前端诚实接收

这也是整个项目“真实性原则”真正落地的核心边界。

---

## 工程原则

### 1. 真实性优先于观感完整

项目明确拒绝以下做法：

- 用静态假数据填充原生指标
- 用推断值冒充实测值
- 用无依据的动画状态暗示真实宿主变化
- 为了截图好看而模糊 `live` 与 `unavailable` 的语义区别

### 2. 降级必须可解释

任何失败都不应被吞掉。对于不可用、加载中、权限不足、宿主缺失等情况，界面应给出明确状态，而不是沉默或伪造。

### 3. 前端与宿主解耦

前端不直接绑定某个采集实现，而是通过 provider 和快照结构消费数据。这样可以在不破坏界面的情况下逐步增强宿主采集能力。

---

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动前端开发环境

```bash
npm run dev
```

### 运行前端测试

```bash
npm run test -- --run
```

### 运行 TypeScript 校验

```bash
npm run lint
```

### 启动 Tauri 桌面壳层

```bash
npm run tauri:dev
```

### 运行 Rust 原生测试

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 目录结构

```text
MacVdesktop/
├─ src/
│  ├─ components/              # 视觉组件与遥测舱界面
│  ├─ domain/telemetry/        # 快照、摘要、布局、浏览器回退数据
│  ├─ hooks/                   # 前端数据装配与轮询逻辑
│  ├─ integrations/telemetry/  # 浏览器 / Tauri provider
│  └─ lib/                     # 运行时与辅助逻辑
├─ src-tauri/
│  └─ src/
│     ├─ lib.rs                # Tauri command 注册入口
│     └─ telemetry.rs          # 原生遥测采集与快照组装
└─ README.md
```

---

## 当前阶段的结论

这个仓库现在已经不是一个单纯的视觉壳，而是一个**带真实宿主边界的桌面遥测项目骨架**：

- 前端可以稳定消费统一快照结构。
- 浏览器环境会诚实回退。
- Tauri 宿主已经具备一批真实指标的采集能力。
- 对于 GPU activity 这类还没有拿到可信路径的指标，系统选择保守而不是伪装完成。

这意味着后续演进可以围绕真实采集链路继续推进，而不是围绕“如何把假数据做得更像真的”继续堆砌。

---

## 下一步建议

后续如果继续往前推进，优先级建议如下：

1. **完善 Apple Silicon 专属采集链路**，尤其是 GPU activity 的可信来源。
2. **收紧指标语义**，继续区分 activity / power / thermal / pressure 等不同层面的信号，避免混用。
3. **补齐宿主侧验证**，让更多状态降级路径有自动化测试覆盖。
4. **在保证真实性前提下继续优化舱室布局与信息密度**，而不是反过来让视觉主导数据结构。

---

## 核心约束

> 这个项目展示的是“真实可得的宿主状态”，不是“想象中的未来遥测面板”。
>
> 如果没有可信数据源，就明确说没有。
>
> 这是实现细节，也是产品原则。
