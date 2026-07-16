<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { canViewStatistics, loadFromStorage, isLoggedIn } from '@/stores/user'
import { ElMessage } from 'element-plus'
import * as statisticsApi from '@/api/statistics'
import type {
  DashboardData, StatisticsData, TrendData,
  CostAnalysis, PieChartData, PartsReplacementData, PredictiveData
} from '@/types'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { use } from 'echarts/core'

use([CanvasRenderer, BarChart, LineChart, PieChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent])

const router = useRouter()
const timeRange = ref('month')
const loading = ref(false)

const dashboardData = ref<DashboardData | null>(null)
const monthlyData = ref<StatisticsData | null>(null)
const trendData = ref<TrendData[]>([])
const costAnalysis = ref<CostAnalysis | null>(null)
const typeDistribution = ref<PieChartData[]>([])
const partsReplacement = ref<PartsReplacementData | null>(null)
const predictiveData = ref<PredictiveData | null>(null)

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)

const yearOptions = computed(() => {
  const y = new Date().getFullYear()
  const list = []
  for (let i = y - 3; i <= y; i++) list.push(i)
  return list
})

async function loadAllData() {
  loading.value = true
  try {
    const [dashRes, monthRes, trendRes, costRes, typeRes, partsRes] = await Promise.all([
      statisticsApi.getDashboardOverview(),
      statisticsApi.getStatistics(currentYear.value, currentMonth.value),
      statisticsApi.getTrendData(timeRange.value === 'week' ? 7 : timeRange.value === 'month' ? 30 : timeRange.value === 'quarter' ? 90 : 365),
      statisticsApi.getCostAnalysis(6),
      statisticsApi.getRecordTypeDistribution(),
      statisticsApi.getPartsReplacement()
    ])
    dashboardData.value = dashRes.data
    monthlyData.value = monthRes.data
    trendData.value = trendRes.data || []
    costAnalysis.value = costRes.data
    typeDistribution.value = typeRes.data || []
    partsReplacement.value = partsRes.data
    renderTrendChart()
    renderTypePieChart()
    renderCostChart()
  } catch (e) {
    ElMessage.error('加载统计数据失败')
    console.error(e)
  } finally { loading.value = false }

  // 预测分析独立加载，失败不影响统计数据展示
  try {
    const predRes = await statisticsApi.getPredictiveAnalysis()
    predictiveData.value = predRes.data
  } catch (e) {
    console.warn('预测分析加载失败:', e)
  }
}

function onTimeRangeChange() { loadAllData() }
function onYearMonthChange() { loadAllData() }

let trendChartInstance: echarts.ECharts | null = null
let pieChartInstance: echarts.ECharts | null = null
let costChartInstance: echarts.ECharts | null = null

function renderTrendChart() {
  const dom = document.getElementById('trend-chart')
  if (!dom) return
  if (!trendChartInstance) {
    trendChartInstance = echarts.init(dom)
  }
  trendChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['维修', '保养', '巡检', '改善'], top: 0 },
    grid: { top: 40, right: 20, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: trendData.value.map(d => d.date.slice(5)), axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '维修', type: 'line', data: trendData.value.map(d => d.repair), smooth: true, color: '#ef4444' },
      { name: '保养', type: 'line', data: trendData.value.map(d => d.maintenance), smooth: true, color: '#3b82f6' },
      { name: '巡检', type: 'line', data: trendData.value.map(d => d.inspection), smooth: true, color: '#10b981' },
      { name: '改善', type: 'line', data: trendData.value.map(d => d.improvement || 0), smooth: true, color: '#f59e0b' }
    ]
  }, true)
}

function renderTypePieChart() {
  const dom = document.getElementById('type-pie-chart')
  if (!dom) return
  if (!pieChartInstance) {
    pieChartInstance = echarts.init(dom)
  }
  pieChartInstance.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 8, top: 'center' },
    series: [{
      type: 'pie', radius: ['45%', '75%'], center: ['38%', '50%'],
      label: { show: false },
      emphasis: { label: { show: true } },
      data: typeDistribution.value.map(d => ({ name: d.name, value: d.value, itemStyle: { color: d.color } }))
    }]
  }, true)
}

function renderCostChart() {
  const dom = document.getElementById('cost-chart')
  if (!dom) return
  if (!costChartInstance) {
    costChartInstance = echarts.init(dom)
  }
  const monthlyCosts = costAnalysis.value?.monthlyCosts || []
  costChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    grid: { top: 10, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category', data: monthlyCosts.map(d => d.month), axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value', name: '元' },
    series: [{
      type: 'bar', data: monthlyCosts.map(d => d.cost),
      itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] }
    }]
  }, true)
}

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) { router.replace('/login'); return }
  if (!canViewStatistics()) { ElMessage.error('您没有权限访问此页面'); router.replace('/'); return }
  loadAllData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (trendChartInstance) { trendChartInstance.dispose(); trendChartInstance = null }
  if (pieChartInstance) { pieChartInstance.dispose(); pieChartInstance = null }
  if (costChartInstance) { costChartInstance.dispose(); costChartInstance = null }
})

function handleResize() {
  trendChartInstance?.resize()
  pieChartInstance?.resize()
  costChartInstance?.resize()
}

function riskClass(level: string) {
  return { high: 'risk-high', medium: 'risk-medium', low: 'risk-low' }[level] || ''
}
function riskLabel(level: string) {
  return { high: '高风险', medium: '中风险', low: '低风险' }[level] || ''
}
function suggestionClass(type: string) {
  return { urgent: 'sg-urgent', danger: 'sg-danger', warning: 'sg-warning', info: 'sg-info' }[type] || ''
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">统计分析</h2>
    </div>

    <div v-loading="loading">
      <!-- 时间范围 -->
      <div class="filter-bar">
        <div class="time-tabs">
          <el-radio-group v-model="timeRange" size="small" @change="onTimeRangeChange">
            <el-radio-button value="week">近7天</el-radio-button>
            <el-radio-button value="month">近30天</el-radio-button>
            <el-radio-button value="quarter">近90天</el-radio-button>
            <el-radio-button value="year">近1年</el-radio-button>
          </el-radio-group>
        </div>
        <div class="month-picker">
          <el-select v-model="currentYear" style="width:110px;" @change="onYearMonthChange">
            <el-option v-for="y in yearOptions" :key="y" :value="y" :label="y+'年'" />
          </el-select>
          <el-select v-model="currentMonth" style="width:90px;margin-left:8px;" @change="onYearMonthChange">
            <el-option v-for="m in 12" :key="m" :value="m" :label="m+'月'" />
          </el-select>
        </div>
      </div>

      <!-- KPI 卡片 -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-value">{{ dashboardData?.totalEquipments || 0 }}</div>
          <div class="kpi-label">设备总数</div>
          <div class="kpi-sub">在用{{ dashboardData?.inUseCount || 0 }} / 停用{{ dashboardData?.stoppedCount || 0 }} / 报废{{ dashboardData?.scrappedCount || 0 }}</div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-value">{{ dashboardData?.monthlyMaintenanceCount || 0 }}</div>
          <div class="kpi-label">本月保养</div>
          <div class="kpi-sub">巡检{{ dashboardData?.monthlyInspectionCount || 0 }}次</div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-value">{{ dashboardData?.monthlyRepairCount || 0 }}</div>
          <div class="kpi-label">本月维修</div>
          <div class="kpi-sub">
            <template v-if="dashboardData?.lastMonthRepairCount">
              环比{{ dashboardData!.monthlyRepairCount > dashboardData!.lastMonthRepairCount ? '↑' : '↓' }}{{ Math.abs(dashboardData!.monthlyRepairCount - dashboardData!.lastMonthRepairCount) }}次
            </template>
            <template v-else>故障率{{ monthlyData?.monthlyFailureRate || 0 }}%</template>
          </div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-value">{{ dashboardData?.mttr || 0 }}<small>h</small></div>
          <div class="kpi-label">MTTR</div>
          <div class="kpi-sub">平均修复时间</div>
        </div>
        <div class="kpi-card kpi-purple">
          <div class="kpi-value">{{ dashboardData?.mtbf || 0 }}<small>天</small></div>
          <div class="kpi-label">MTBF</div>
          <div class="kpi-sub">平均故障间隔</div>
        </div>
        <div class="kpi-card kpi-teal">
          <div class="kpi-value">{{ dashboardData?.availabilityRate || 0 }}<small>%</small></div>
          <div class="kpi-label">可用率 / 保养执行率</div>
          <div class="kpi-sub">保养执行率{{ dashboardData?.maintenanceRate || 0 }}%</div>
        </div>
      </div>

      <!-- 趋势图 + 类型饼图 -->
      <el-row :gutter="16" class="chart-row">
        <el-col :xs="24" :lg="14">
          <div class="chart-card">
            <h4>运维趋势</h4>
            <div id="trend-chart" style="height:320px;"></div>
          </div>
        </el-col>
        <el-col :xs="24" :lg="10">
          <div class="chart-card">
            <h4>记录类型分布</h4>
            <div id="type-pie-chart" style="height:320px;"></div>
          </div>
        </el-col>
      </el-row>

      <!-- 成本分析 + 设备故障率排行 -->
      <el-row :gutter="16" class="chart-row">
        <el-col :xs="24" :lg="12">
          <div class="chart-card">
            <h4>费用分析
              <span class="cost-summary">
                总费用: ¥{{ costAnalysis?.totalCost || 0 }} | 人工: ¥{{ costAnalysis?.laborCost || 0 }} | 配件: ¥{{ costAnalysis?.partsCost || 0 }}
              </span>
            </h4>
            <div id="cost-chart" style="height:320px;" v-if="(costAnalysis?.monthlyCosts || []).length > 0"></div>
            <el-empty v-else description="暂无费用数据" :image-size="80" />
          </div>
        </el-col>
        <el-col :xs="24" :lg="12">
          <div class="chart-card">
            <h4>设备故障率排行 TOP10</h4>
            <div style="max-height:320px;overflow:auto;">
              <table class="rank-table" v-if="(monthlyData?.equipmentFailureRates || []).length > 0">
                <thead>
                  <tr><th>#</th><th>设备名称</th><th>维修次数</th><th>巡检次数</th><th>故障率</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(e, i) in monthlyData?.equipmentFailureRates" :key="e.equipmentId" :class="{ 'top3': i < 3 }">
                    <td class="rank-num">{{ i + 1 }}</td>
                    <td class="rank-name">{{ e.equipmentName }}</td>
                    <td>{{ e.repairCount }}</td>
                    <td>{{ e.inspectionCount }}</td>
                    <td>{{ e.failureRate }}%</td>
                  </tr>
                </tbody>
              </table>
              <el-empty v-else description="暂无数据" :image-size="80" />
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 易损件统计 -->
      <div class="chart-card" v-if="(monthlyData?.vulnerableParts || []).length > 0">
        <h4>易损件统计</h4>
        <table class="rank-table">
          <thead>
            <tr><th>#</th><th>配件名称</th><th>更换次数</th></tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in monthlyData?.vulnerableParts" :key="i" :class="{ 'top3': i < 3 }">
              <td class="rank-num">{{ i + 1 }}</td>
              <td class="rank-name">{{ p.partName }}</td>
              <td>{{ p.replaceCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 配件更换消耗 -->
      <div class="chart-card" v-if="partsReplacement && partsReplacement.totalReplacements > 0">
        <h4>配件更换消耗
          <span class="cost-summary">共更换 {{ partsReplacement.totalReplacements }} 次</span>
        </h4>
        <el-row :gutter="16">
          <!-- 配件更换排行 -->
          <el-col :xs="24" :lg="12">
            <p style="font-size:13px;color:#909399;margin:0 0 8px;">配件更换排行</p>
            <table class="rank-table" v-if="partsReplacement.partsStats.length > 0">
              <thead>
                <tr><th>#</th><th>配件名称</th><th>更换次数</th></tr>
              </thead>
              <tbody>
                <tr v-for="(p, i) in partsReplacement.partsStats.slice(0, 10)" :key="i" :class="{ 'top3': i < 3 }">
                  <td class="rank-num">{{ i + 1 }}</td>
                  <td class="rank-name">{{ p.name }}</td>
                  <td>{{ p.count }}</td>
                </tr>
              </tbody>
            </table>
            <el-empty v-else description="暂无数据" :image-size="60" />
          </el-col>
          <!-- 设备更换排行 -->
          <el-col :xs="24" :lg="12">
            <p style="font-size:13px;color:#909399;margin:0 0 8px;">设备更换排行</p>
            <table class="rank-table" v-if="partsReplacement.equipmentStats.length > 0">
              <thead>
                <tr><th>#</th><th>设备名称</th><th>更换次数</th></tr>
              </thead>
              <tbody>
                <tr v-for="(e, i) in partsReplacement.equipmentStats.slice(0, 10)" :key="i" :class="{ 'top3': i < 3 }">
                  <td class="rank-num">{{ i + 1 }}</td>
                  <td class="rank-name">{{ e.name }}</td>
                  <td>{{ e.count }}</td>
                </tr>
              </tbody>
            </table>
            <el-empty v-else description="暂无数据" :image-size="60" />
          </el-col>
        </el-row>
        <!-- 最近更换记录 -->
        <div style="margin-top:16px;" v-if="partsReplacement.partsList.length > 0">
          <p style="font-size:13px;color:#909399;margin:0 0 8px;">最近更换记录</p>
          <table class="rank-table">
            <thead>
              <tr><th>日期</th><th>设备名称</th><th>更换配件</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in partsReplacement.partsList.slice(0, 10)" :key="i">
                <td>{{ r.date }}</td>
                <td class="rank-name">{{ r.equipmentName }}</td>
                <td style="text-align:left;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" :title="r.detail">{{ r.detail }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========== 预测分析 ========== -->
      <template v-if="predictiveData">
        <div class="section-divider">
          <h3 class="section-title">预测分析与预防建议</h3>
        </div>

        <!-- 健康评分 KPI -->
        <div class="kpi-row">
          <div class="kpi-card kpi-red">
            <div class="kpi-value">{{ predictiveData.highRiskEquipments.filter(e => e.riskLevel === 'high').length }}</div>
            <div class="kpi-label">高风险设备</div>
          </div>
          <div class="kpi-card kpi-orange">
            <div class="kpi-value">{{ predictiveData.highRiskEquipments.filter(e => e.riskLevel === 'medium').length }}</div>
            <div class="kpi-label">中风险设备</div>
          </div>
          <div class="kpi-card kpi-green">
            <div class="kpi-value">{{ predictiveData.healthScores.filter(e => e.riskLevel === 'low').length }}</div>
            <div class="kpi-label">低风险设备</div>
          </div>
          <div class="kpi-card kpi-blue">
            <div class="kpi-value">{{ predictiveData.healthScores.length > 0 ? Math.round(predictiveData.healthScores.reduce((s, e) => s + e.score, 0) / predictiveData.healthScores.length) : 0 }}</div>
            <div class="kpi-label">平均健康分</div>
          </div>
        </div>

        <!-- 保养逾期预警 + 高风险设备 -->
        <el-row :gutter="16" class="chart-row">
          <el-col :xs="24" :lg="12">
            <div class="chart-card">
              <h4>保养逾期预警
                <span class="cost-summary">逾期 {{ predictiveData.maintenanceAnalysis.overduePlans.length }} 项</span>
              </h4>
              <div style="max-height:300px;overflow:auto;">
                <table class="rank-table" v-if="predictiveData.maintenanceAnalysis.overduePlans.length > 0">
                  <thead>
                    <tr><th>设备名称</th><th>保养计划</th><th>逾期天数</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p, i) in predictiveData.maintenanceAnalysis.overduePlans" :key="i" :class="{ 'row-danger': p.overdueDays > 7 }">
                      <td class="rank-name">{{ p.equipmentName }}</td>
                      <td>{{ p.planName }}</td>
                      <td><span class="tag-red">{{ p.overdueDays }}天</span></td>
                    </tr>
                  </tbody>
                </table>
                <el-empty v-else description="暂无逾期保养计划" :image-size="60" />
              </div>
            </div>
          </el-col>
          <el-col :xs="24" :lg="12">
            <div class="chart-card">
              <h4>高风险设备
                <span class="cost-summary">共 {{ predictiveData.highRiskEquipments.length }} 台</span>
              </h4>
              <div style="max-height:300px;overflow:auto;">
                <table class="rank-table" v-if="predictiveData.highRiskEquipments.length > 0">
                  <thead>
                    <tr><th>设备名称</th><th>健康分</th><th>风险</th><th>巡检异常</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(e, i) in predictiveData.highRiskEquipments" :key="i" :class="[riskClass(e.riskLevel)]">
                      <td class="rank-name">{{ e.equipmentName }}</td>
                      <td>{{ e.score }}</td>
                      <td><span :class="'tag-' + (e.riskLevel === 'high' ? 'red' : e.riskLevel === 'medium' ? 'orange' : 'green')">{{ riskLabel(e.riskLevel) }}</span></td>
                      <td style="text-align:left;font-size:12px;">{{ e.topFailItems.join('、') || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
                <el-empty v-else description="暂无高风险设备" :image-size="60" />
              </div>
            </div>
          </el-col>
        </el-row>

        <!-- 保养效果分析 + 周期建议 -->
        <el-row :gutter="16" class="chart-row" v-if="predictiveData.maintenanceAnalysis.ineffectiveMaintenances.length > 0 || predictiveData.maintenanceAnalysis.cycleSuggestions.length > 0">
          <el-col :xs="24" :lg="12" v-if="predictiveData.maintenanceAnalysis.ineffectiveMaintenances.length > 0">
            <div class="chart-card">
              <h4>保养效果评估
                <span class="cost-summary">保养后仍有故障</span>
              </h4>
              <div style="max-height:250px;overflow:auto;">
                <table class="rank-table">
                  <thead>
                    <tr><th>设备名称</th><th>保养日期</th><th>保养后故障次数</th><th>最短故障间隔</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(m, i) in predictiveData.maintenanceAnalysis.ineffectiveMaintenances" :key="i">
                      <td class="rank-name">{{ m.equipmentName }}</td>
                      <td>{{ m.maintenanceDate }}</td>
                      <td>{{ m.repairAfterCount }}</td>
                      <td>{{ m.minDaysToRepair }}天</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </el-col>
          <el-col :xs="24" :lg="predictiveData.maintenanceAnalysis.ineffectiveMaintenances.length > 0 ? 12 : 24" v-if="predictiveData.maintenanceAnalysis.cycleSuggestions.length > 0">
            <div class="chart-card">
              <h4>保养周期建议
                <span class="cost-summary">建议调整周期</span>
              </h4>
              <div style="max-height:250px;overflow:auto;">
                <table class="rank-table">
                  <thead>
                    <tr><th>设备名称</th><th>当前周期</th><th>建议周期</th><th>原因</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(c, i) in predictiveData.maintenanceAnalysis.cycleSuggestions" :key="i">
                      <td class="rank-name">{{ c.equipmentName }}</td>
                      <td>{{ c.currentCycleDays }}天</td>
                      <td><span class="tag-orange">{{ c.suggestedCycleDays }}天</span></td>
                      <td style="font-size:12px;">故障间隔{{ c.avgRepairGapDays }}天</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </el-col>
        </el-row>

        <!-- 预防性维护建议 -->
        <div class="chart-card" v-if="predictiveData.suggestions.length > 0">
          <h4>预防性维护建议
            <span class="cost-summary">共 {{ predictiveData.suggestions.length }} 条</span>
          </h4>
          <div class="suggestion-list">
            <div v-for="(s, i) in predictiveData.suggestions" :key="i" :class="'suggestion-item ' + suggestionClass(s.type)">
              <div class="sg-header">
                <span :class="'sg-badge ' + suggestionClass(s.type)">{{ s.title }}</span>
                <span class="sg-equip" v-if="s.equipmentName">{{ s.equipmentName }}</span>
              </div>
              <div class="sg-content">{{ s.content }}</div>
            </div>
          </div>
        </div>

        <!-- 配件更换预测 -->
        <div class="chart-card" v-if="predictiveData.partsPredictions.length > 0">
          <h4>配件更换预测
            <span class="cost-summary">共 {{ predictiveData.partsPredictions.length }} 项</span>
          </h4>
          <div style="max-height:300px;overflow:auto;">
            <table class="rank-table">
              <thead>
                <tr><th>配件名称</th><th>平均更换周期</th><th>上次更换</th><th>预计下次更换</th><th>剩余天数</th></tr>
              </thead>
              <tbody>
                <tr v-for="(p, i) in predictiveData.partsPredictions" :key="i" :class="{ 'row-danger': p.daysUntil <= 7, 'row-warning': p.daysUntil > 7 && p.daysUntil <= 30 }">
                  <td class="rank-name">{{ p.partName }}</td>
                  <td>{{ p.avgCycleDays }}天</td>
                  <td>{{ p.lastReplaceDate }}</td>
                  <td>{{ p.predictedNext }}</td>
                  <td>
                    <span :class="p.daysUntil <= 7 ? 'tag-red' : p.daysUntil <= 30 ? 'tag-orange' : 'tag-green'">
                      {{ p.daysUntil > 0 ? p.daysUntil + '天' : '已到期' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.time-tabs :deep(.el-radio-button__inner) {
  padding: 6px 14px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  padding: 0 24px;
  margin-bottom: 16px;
}

.kpi-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 18px;
  border-left: 4px solid #dcdfe6;
  background: linear-gradient(to right, #fff, #fafafa);
}

.kpi-card.kpi-blue { border-left-color: #3b82f6; background: linear-gradient(to right, #f0f6ff, #fff); }
.kpi-card.kpi-red { border-left-color: #ef4444; background: linear-gradient(to right, #fef2f2, #fff); }
.kpi-card.kpi-green { border-left-color: #10b981; background: linear-gradient(to right, #ecfdf5, #fff); }
.kpi-card.kpi-purple { border-left-color: #8b5cf6; background: linear-gradient(to right, #f5f3ff, #fff); }
.kpi-card.kpi-teal { border-left-color: #14b8a6; background: linear-gradient(to right, #f0fdfa, #fff); }

.kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}
.kpi-value small { font-size: 14px; font-weight: 400; color: #909399; }

.kpi-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.kpi-sub {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 2px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  margin: 0 24px 16px;
}

.chart-card h4 {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px;
}

.cost-summary {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
  margin-left: 12px;
}

.chart-row {
  margin: 0 -8px 16px;
}

.rank-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.rank-table th {
  background: #f5f7fa;
  padding: 10px 12px;
  text-align: center;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #ebeef5;
}

.rank-table td {
  padding: 9px 12px;
  text-align: center;
  border-bottom: 1px solid #f5f7fa;
  color: #606266;
}

.rank-table .rank-num {
  font-weight: 700;
  color: #c0c4cc;
  width: 40px;
}

.rank-table .top3 .rank-num { color: #f59e0b; }
.rank-table .rank-name { text-align: left; font-weight: 500; color: #303133; }

/* 移动端 */
@media (max-width: 768px) {
  .kpi-row { grid-template-columns: repeat(3, 1fr); padding: 0 12px; gap: 8px; }
  .kpi-card { padding: 10px 12px; }
  .kpi-value { font-size: 18px; }
  .kpi-value small { font-size: 11px; }
  .chart-card { margin: 0 12px 12px; padding: 14px; }
  .filter-bar { padding: 12px; }
  .month-picker { margin-top: 8px; }
  .chart-card h4 { font-size: 14px; }
}

/* 预测分析样式 */
.section-divider {
  padding: 0 24px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  padding-bottom: 12px;
  border-bottom: 2px solid #409eff;
  margin: 0;
}
.kpi-orange { border-left-color: #f59e0b; background: linear-gradient(to right, #fffbeb, #fff); }
.kpi-orange .kpi-value { color: #d97706; }

.risk-high { background: #fef2f2 !important; }
.risk-medium { background: #fffbeb !important; }
.risk-low { background: #f0fdf4 !important; }

.row-danger { background: #fef2f2 !important; }
.row-warning { background: #fffbeb !important; }

.tag-red { color: #dc2626; background: #fef2f2; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.tag-orange { color: #d97706; background: #fffbeb; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.tag-green { color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }

/* 建议卡片 */
.suggestion-list { display: flex; flex-direction: column; gap: 10px; }
.suggestion-item { padding: 14px 16px; border-radius: 10px; border-left: 4px solid #dcdfe6; background: #fafafa; }
.suggestion-item.sg-urgent { border-left-color: #dc2626; background: #fef2f2; }
.suggestion-item.sg-danger { border-left-color: #ef4444; background: #fef2f2; }
.suggestion-item.sg-warning { border-left-color: #f59e0b; background: #fffbeb; }
.suggestion-item.sg-info { border-left-color: #3b82f6; background: #eff6ff; }
.sg-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sg-badge { padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #fff; }
.sg-badge.sg-urgent { background: #dc2626; }
.sg-badge.sg-danger { background: #ef4444; }
.sg-badge.sg-warning { background: #f59e0b; color: #fff; }
.sg-badge.sg-info { background: #3b82f6; }
.sg-equip { font-size: 13px; color: #303133; font-weight: 500; }
.sg-content { font-size: 13px; color: #606266; line-height: 1.5; }
</style>