import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, Clock, DollarSign, Users, Package, TrendingUp } from 'lucide-react';

const AffiliateMetricsDashboard = () => {
  const [affiliateId, setAffiliateId] = useState('');
  const [earnings, setEarnings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [affiliateData, setAffiliateData] = useState(null);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  useEffect(() => {
    // Get affiliate ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id') || JSON.parse(localStorage.getItem('currentAffiliate'))?.affiliateId || 'AFF123456';
    setAffiliateId(id);

    // Load mock data for demo purposes
    loadMockData(id, timeRange);
  }, [timeRange]);

  const loadMockData = (id, period) => {
    setLoading(true);

    // Mock affiliate data
    const mockAffiliate = {
      affiliateId: id,
      firstName: 'Demo',
      lastName: 'Affiliate',
      deliveryFee: 5.99,
      customerCount: 18,
      activeOrderCount: 12,
      totalEarnings: 1285.75,
      pendingEarnings: 345.50,
      weekEarnings: 245.30,
      monthEarnings: 962.45,
      joiningDate: new Date('2024-11-15').toISOString(),
      nextPayout: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
    };
    
    setAffiliateData(mockAffiliate);

    // Generate mock earnings data
    const mockEarnings = generateEarningsData(period);
    setEarnings(mockEarnings);

    // Generate mock customer acquisition data
    const mockCustomers = generateCustomerData(period);
    setCustomers(mockCustomers);

    // Generate mock order data by size
    const mockOrdersBySize = [
      { name: 'Small (10-15 lbs)', value: 25 },
      { name: 'Medium (16-30 lbs)', value: 45 },
      { name: 'Large (31+ lbs)', value: 30 }
    ];
    setOrders(mockOrdersBySize);

    setLoading(false);
  };

  const generateEarningsData = (period) => {
    const data = [];
    const now = new Date();
    let iterations = 0;
    
    switch(period) {
      case 'week':
        iterations = 7;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setDate(now.getDate() - i);
          data.unshift({
            date: date.toLocaleDateString('en-US', { weekday: 'short' }),
            wdfCommission: Math.random() * 30 + 15,
            deliveryFees: Math.random() * 50 + 20,
            total: Math.random() * 80 + 35,
          });
        }
        break;
      case 'month':
        iterations = 30;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setDate(now.getDate() - i);
          data.unshift({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            wdfCommission: Math.random() * 30 + 15,
            deliveryFees: Math.random() * 50 + 20,
            total: Math.random() * 80 + 35,
          });
        }
        break;
      case 'year':
        iterations = 12;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setMonth(now.getMonth() - i);
          data.unshift({
            date: date.toLocaleDateString('en-US', { month: 'short' }),
            wdfCommission: Math.random() * 300 + 150,
            deliveryFees: Math.random() * 500 + 200,
            total: Math.random() * 800 + 350,
          });
        }
        break;
      default:
        iterations = 30;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setDate(now.getDate() - i);
          data.unshift({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            wdfCommission: Math.random() * 30 + 15,
            deliveryFees: Math.random() * 50 + 20,
            total: Math.random() * 80 + 35,
          });
        }
    }
    
    return data;
  };

  const generateCustomerData = (period) => {
    const data = [];
    const now = new Date();
    let iterations = 0;
    
    switch(period) {
      case 'week':
        iterations = 7;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setDate(now.getDate() - i);
          data.unshift({
            date: date.toLocaleDateString('en-US', { weekday: 'short' }),
            newCustomers: Math.floor(Math.random() * 3),
            activeCustomers: Math.floor(Math.random() * 8 + 5),
          });
        }
        break;
      case 'month':
        iterations = 30;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setDate(now.getDate() - i);
          data.unshift({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            newCustomers: Math.floor(Math.random() * 2),
            activeCustomers: Math.floor(Math.random() * 6 + 3),
          });
        }
        break;
      case 'year':
        iterations = 12;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setMonth(now.getMonth() - i);
          data.unshift({
            date: date.toLocaleDateString('en-US', { month: 'short' }),
            newCustomers: Math.floor(Math.random() * 10 + 2),
            activeCustomers: Math.floor(Math.random() * 15 + 5),
          });
        }
        break;
      default:
        iterations = 30;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setDate(now.getDate() - i);
          data.unshift({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            newCustomers: Math.floor(Math.random() * 2),
            activeCustomers: Math.floor(Math.random() * 6 + 3),
          });
        }
    }
    
    return data;
  };

  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value);
  };

  if (loading || !affiliateData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Affiliate Dashboard</h2>
          <p className="text-gray-600">{`Welcome, ${affiliateData.firstName} ${affiliateData.lastName}`}</p>
        </div>
        <div className="mt-4 md:mt-0">
          <select 
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={timeRange}
            onChange={handleTimeRangeChange}
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last 12 Months</option>
          </select>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Earnings</p>
              <p className="text-2xl font-bold">${affiliateData.totalEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <DollarSign size={20} className="text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600 font-medium">+12.5%</span>
            <span className="text-sm text-gray-500 ml-1">from last {timeRange}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Active Orders</p>
              <p className="text-2xl font-bold">{affiliateData.activeOrderCount}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Package size={20} className="text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600 font-medium">+5.2%</span>
            <span className="text-sm text-gray-500 ml-1">from last {timeRange}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Customers</p>
              <p className="text-2xl font-bold">{affiliateData.customerCount}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Users size={20} className="text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600 font-medium">+8.1%</span>
            <span className="text-sm text-gray-500 ml-1">from last {timeRange}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Next Payout</p>
              <p className="text-2xl font-bold">${affiliateData.pendingEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Calendar size={20} className="text-yellow-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">Estimated date: {affiliateData.nextPayout}</span>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Earnings Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Earnings Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earnings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="wdfCommission" name="WDF Commission" stroke="#0088FE" strokeWidth={2} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="deliveryFees" name="Delivery Fees" stroke="#00C49F" strokeWidth={2} />
                <Line type="monotone" dataKey="total" name="Total" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Acquisition Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Customer Activity</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="newCustomers" name="New Customers" fill="#8884d8" />
                <Bar dataKey="activeCustomers" name="Active Customers" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Distribution by Size */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Orders by Size</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orders}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {orders.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} orders`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Performance Metrics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Customer Satisfaction</span>
                <span className="text-sm font-medium">92%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: "92%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">On-time Delivery</span>
                <span className="text-sm font-medium">88%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: "88%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Customer Retention</span>
                <span className="text-sm font-medium">95%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: "95%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Order Growth Rate</span>
                <span className="text-sm font-medium">15%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-yellow-500 h-2.5 rounded-full" style={{ width: "15%" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-blue-100 p-2 rounded-full mr-3">
                <Package size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">New order #ORD835719</p>
                <p className="text-xs text-gray-500">Today, 10:45 AM</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-green-100 p-2 rounded-full mr-3">
                <Users size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">New customer registered</p>
                <p className="text-xs text-gray-500">Yesterday, 2:30 PM</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-purple-100 p-2 rounded-full mr-3">
                <DollarSign size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Commission payment received</p>
                <p className="text-xs text-gray-500">May 15, 2025</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-yellow-100 p-2 rounded-full mr-3">
                <Clock size={16} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Order #ORD723541 delivered</p>
                <p className="text-xs text-gray-500">May 14, 2025</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-red-100 p-2 rounded-full mr-3">
                <TrendingUp size={16} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Monthly summary available</p>
                <p className="text-xs text-gray-500">May 1, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AffiliateMetricsDashboard;