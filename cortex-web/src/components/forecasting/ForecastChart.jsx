import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const sortByWeek = (a, b) => String(a.forecast_week_start).localeCompare(String(b.forecast_week_start));

const ForecastChart = ({ scenarios = [] }) => {
  const data = useMemo(() => {
    const list = Array.isArray(scenarios) ? scenarios : [];
    const realistic = list.filter((x) => x.scenario === 'realistic').sort(sortByWeek);
    const optimistic = list.filter((x) => x.scenario === 'optimistic').sort(sortByWeek);
    const pessimistic = list.filter((x) => x.scenario === 'pessimistic').sort(sortByWeek);

    const labels = realistic.map((x) => {
      const d = new Date(x.forecast_week_start);
      return Number.isNaN(d.getTime()) ? String(x.forecast_week_start) : d.toLocaleDateString();
    });

    return {
      labels,
      datasets: [
        {
          label: 'Lower (80%)',
          data: realistic.map((x) => x.confidence_lower),
          borderColor: 'rgba(63,111,255,0.0)',
          pointRadius: 0,
          fill: '+1'
        },
        {
          label: 'Upper (80%)',
          data: realistic.map((x) => x.confidence_upper),
          borderColor: 'rgba(63,111,255,0.0)',
          backgroundColor: 'rgba(63,111,255,0.14)',
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Realistic',
          data: realistic.map((x) => x.predicted_demand),
          borderColor: 'rgb(0,255,209)',
          backgroundColor: 'rgba(0,255,209,0.10)',
          tension: 0.35,
          pointRadius: 2
        },
        {
          label: 'Optimistic',
          data: optimistic.map((x) => x.predicted_demand),
          borderColor: 'rgba(255,255,255,0.55)',
          borderDash: [6, 6],
          tension: 0.35,
          pointRadius: 0
        },
        {
          label: 'Pessimistic',
          data: pessimistic.map((x) => x.predicted_demand),
          borderColor: 'rgba(255,107,53,0.75)',
          borderDash: [6, 6],
          tension: 0.35,
          pointRadius: 0
        }
      ]
    };
  }, [scenarios]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: 'rgba(255,255,255,0.75)' }
        },
        tooltip: {
          intersect: false,
          mode: 'index'
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.65)' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          ticks: { color: 'rgba(255,255,255,0.65)' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    }),
    []
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default ForecastChart;

