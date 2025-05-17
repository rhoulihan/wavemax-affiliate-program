import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Package, DollarSign, Truck, Clock, BarChart2 } from 'lucide-react';

const CustomerDashboardAnalytics = () => {
  const [customerId, setCustomerId] = useState('');
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [orderHistory, setOrderHistory] = useState([]);
  const [spendingData, setSpendingData] = useState([]);
  const [orderSizes, setOrderSizes] = useState([]);
  const [customerData, setCustomerData] = useState(null);
  const [nextPickup, setNextPickup] = useState(null);
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  useEffect(() => {
    // Get customer ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id') || JSON.parse(localStorage.getItem('currentCustomer'))?.customerId || 'CUST123456';
    setCustomerId(id);

    // Load mock data for demo purposes
    loadMockData(id, timeRange);
  }, [timeRange]);

  const loadMockData = (id, period) => {
    setLoading(true);

    // Mock customer data
    const mockCustomer = {
      customerId: id,
      firstName: 'Demo',
      lastName: 'Customer',
      email: 'demo@example.com',
      totalOrders: 24,
      activeOrders: 2,
      totalSpent: 745.32,
      preferredSize: 'Medium',
      address: '123 Main St, Austin, TX 78701',
      lastOrderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      joiningDate: new Date('2024-11-15').toISOString()
    };
    
    setCustomerData(mockCustomer);

    // Mock next pickup data
    const nextPickupDate = new Date();
    nextPickupDate.setDate(nextPickupDate.getDate() + 3);
    
    const mockNextPickup = {
      orderId: 'ORD' + Math.floor(100000 + Math.random() * 900000),
      date: nextPickupDate.toLocaleDateString(),
      time: '1:00 PM - 5:00 PM',
      estimatedSize: 'Medium (16-30 lbs)',
      estimatedTotal: '$43.50',
      status: 'scheduled'
    };
    
    setNextPickup(mockNextPickup);

    // Generate mock order history
    const mockOrderHistory = generateOrderHistory(period);
    setOrderHistory(mockOrderHistory);

    // Generate mock spending data
    const mockSpendingData = generateSpendingData(period);
    setSpendingData(mockSpendingData);

    // Generate mock order size distribution
    const mockOrderSizes = [
      { name: 'Small (10-15 lbs)', value: 8 },
      { name: 'Medium (16-30 lbs)', value: 11 },
      { name: 'Large (31+ lbs)', value: 5 }
    ];
    setOrderSizes(mockOrderSizes);

    setLoading(false);
  };

  const generateOrderHistory = (period) => {
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
            orders: Math.random() > 0.7 ? 1 : 0,
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
            orders: Math.random() > 0.7 ? 1 : 0,
          });
        }
        break;
      case 'year':
        iterations = 12;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setMonth(now.getMonth() - i);
          const orderCount = Math.floor(Math.random() * 4 + 1);
          data.unshift({
            date: date.toLocaleDateString('en-US', { month: 'short' }),
            orders: orderCount,
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
            orders: Math.random() > 0.7 ? 1 : 0,
          });
        }
    }
    
    return data;
  };

  const generateSpendingData = (period) => {
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
            amount: Math.random() > 0.7 ? Math.random() * 30 + 20 : 0,
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
            amount: Math.random() > 0.7 ? Math.random() * 30 + 20 : 0,
          });
        }
        break;
      case 'year':
        iterations = 12;
        for (let i = 0; i < iterations; i++) {
          const date = new Date();
          date.setMonth(now.getMonth() - i);
          const amount = Math.random() * 120 + 40;
          data.unshift({
            date: date.toLocaleDateString('en-US', { month: 'short' }),
            amount: amount,
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
            amount: Math.random() > 0.7 ? Math.random() * 30 + 20 : 0,
          });
        }
    }
    
    return data;
  };

  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value);
  };

  // Calculate total amount spent in the period
  const calculatePeriodSpending = () => {
    return spendingData.reduce((total, item) => total + item.amount, 0).toFixed(2);
  };

  // Calculate total orders in the period
  const calculatePeriodOrders = () => {
    return orderHistory.reduce((total, item) => total + item.orders, 0);
  };

  if (loading || !customerData) {
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
          <h2 className="text-2xl font-bold text-gray-800">Customer Dashboard</h2>
          <p className="text-gray-600">{`Hello, ${customerData.firstName} ${customerData.lastName}`}</p>
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

      {/* Next Pickup Alert */}
      {nextPickup && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Your Next Scheduled Pickup</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p className="mb-1"><span className="font-semibold">Date & Time:</span> {nextPickup.date} at {nextPickup.time}</p>
                <p className="mb-1"><span className="font-semibold">Estimated Size:</span> {nextPickup.estimatedSize}</p>
                <p><span className="font-semibold">Estimated Total:</span> {nextPickup.estimatedTotal}</p>
              </div>
              <div className="mt-3">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm">
                  View Order Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Orders</p>
              <p className="text-2xl font-bold">{customerData.totalOrders}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Package size={20} className="text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">{calculatePeriodOrders()} in this period</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Spent</p>
              <p className="text-2xl font-bold">${customerData.totalSpent.toFixed(2)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign size={20} className="text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">${calculatePeriodSpending()} in this period</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Active Orders</p>
              <p className="text-2xl font-bold">{customerData.activeOrders}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Truck size={20} className="text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">Last order: {customerData.lastOrderDate}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Avg. Turnaround</p>
              <p className="text-2xl font-bold">48h</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Clock size={20} className="text-yellow-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">From pickup to delivery</span>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Order History Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Order History</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orderHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value} orders`, 'Orders']} />
                <Bar dataKey="orders" name="Orders" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Spending Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spendingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Line type="monotone" dataKey="amount" name="Amount Spent" stroke="#82ca9d" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Size Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Order Size Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderSizes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {orderSizes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} orders`, 'Orders']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Laundry Statistics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Laundry Statistics</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Total Weight Processed</span>
                <span className="font-bold">394 lbs</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Small: 118 lbs</span>
                <span>Medium: 201 lbs</span>
                <span>Large: 75 lbs</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Most Common Day</span>
                <span className="font-bold">Monday</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="flex">
                  <div className="bg-blue-600 h-2.5 rounded-l-full" style={{ width: "25%" }}></div>
                  <div className="bg-green-500 h-2.5" style={{ width: "15%" }}></div>
                  <div className="bg-yellow-500 h-2.5" style={{ width: "10%" }}></div>
                  <div className="bg-orange-500 h-2.5" style={{ width: "18%" }}></div>
                  <div className="bg-red-500 h-2.5" style={{ width: "12%" }}></div>
                  <div className="bg-purple-500 h-2.5" style={{ width: "8%" }}></div>
                  <div className="bg-pink-500 h-2.5 rounded-r-full" style={{ width: "12%" }}></div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Average Order Size</span>
                <span className="font-bold">16.4 lbs</span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1"></span>
                <span className="text-sm">Your average</span>
                <div className="flex-grow mx-2 bg-gray-200 h-0.5 relative">
                  <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-1 h-3 bg-gray-500"></div>
                </div>
                <span className="text-sm">18.2 lbs city average</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Favorite Delivery Time</span>
                <span className="font-bold">Afternoon (12pm-5pm)</span>
              </div>
              <div className="flex space-x-1">
                <div className="w-1/3 bg-blue-100 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-blue-800">15%</div>
                  <div className="text-xs text-blue-600">Morning</div>
                </div>
                <div className="w-1/3 bg-green-100 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-green-800">65%</div>
                  <div className="text-xs text-green-600">Afternoon</div>
                </div>
                <div className="w-1/3 bg-purple-100 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-purple-800">20%</div>
                  <div className="text-xs text-purple-600">Evening</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboardAnalytics;