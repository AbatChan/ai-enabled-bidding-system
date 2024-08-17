import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { FaSearch, FaCircle, FaEdit, FaPlus, FaChartBar } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AIEditChatBox from './AIEditChatBox';

const AIEnabledBiddingDashboard = () => {
    const [bids, setBids] = useState([]);
    const [filteredBids, setFilteredBids] = useState([]);
    const [selectedBid, setSelectedBid] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isChartView, setIsChartView] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);

    useEffect(() => {
        fetchBids();
    }, []);

    useEffect(() => {
        setFilteredBids(
            bids.filter(bid => 
                bid.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                bid.description.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [searchTerm, bids]);

    const fetchBids = async () => {
        try {
            const response = await fetch(aiebsData.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'aiebs_get_user_bids',
                    nonce: aiebsData.nonce,
                }),
            });
            const data = await response.json();
            if (data.success) {
                setBids(data.data);
                setFilteredBids(data.data);
            } else {
                console.error('Failed to fetch bids:', data.message);
            }
        } catch (error) {
            console.error('Error fetching bids:', error);
        }
    };

    const handleEditLineItem = (index, field, value) => {
        const updatedBid = { ...selectedBid };
        updatedBid.lineItems[index][field] = value;
        setSelectedBid(updatedBid);
    };

    const handleAddLineItem = () => {
        const updatedBid = { ...selectedBid };
        updatedBid.lineItems.push({ name: '', price: 0, quantity: 1, unit: '' });
        setSelectedBid(updatedBid);
    };

    const handleRemoveLineItem = (index) => {
        const updatedBid = { ...selectedBid };
        updatedBid.lineItems.splice(index, 1);
        setSelectedBid(updatedBid);
    };

    const handleAIEdit = () => {
        setIsAIChatOpen(true);
    };

    const handleBidClick = (bid) => {
        setSelectedBid(bid);
        setIsModalOpen(true);
        setIsEditing(false);
    };

    const handleDeleteBid = async (bidId) => {
        if (window.confirm("Are you sure you want to delete this bid?")) {
            try {
                const response = await fetch(aiebsData.ajaxUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        action: 'aiebs_delete_bid',
                        nonce: aiebsData.nonce,
                        bid_id: bidId,
                    }),
                });
                const data = await response.json();
                if (data.success) {
                    fetchBids();
                } else {
                    console.error('Failed to delete bid:', data.message);
                }
            } catch (error) {
                console.error('Error deleting bid:', error);
            }
        }
    };

    const handleStatusChange = async (bidId, newStatus) => {
        try {
            const response = await fetch(aiebsData.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'aiebs_update_bid_status',
                    nonce: aiebsData.nonce,
                    bid_id: bidId,
                    status: newStatus,
                }),
            });
            const data = await response.json();
            if (data.success) {
                fetchBids();
            } else {
                console.error('Failed to update bid status:', data.message);
            }
        } catch (error) {
            console.error('Error updating bid status:', error);
        }
    };

    const getStatusIcon = (status) => {
        let color;
        switch(status.toLowerCase()) {
            case 'pending':
                color = 'text-yellow-500';
                break;
            case 'approved':
                color = 'text-green-500';
                break;
            case 'rejected':
                color = 'text-red-500';
                break;
            default:
                color = 'text-gray-500';
        }
        return (
            <div className="relative group">
                <FaCircle className={`${color} text-2xl`} />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {status}
                </span>
            </div>
        );
    };

    const handleEditBid = (bid) => {
        setSelectedBid(bid);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleSaveBidEdit = async (updatedBid) => {
        try {
            const response = await fetch(aiebsData.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'aiebs_update_bid',
                    nonce: aiebsData.nonce,
                    bid: JSON.stringify(updatedBid),
                }),
            });
            const data = await response.json();
            if (data.success) {
                setBids(bids.map(b => b.id === updatedBid.id ? updatedBid : b));
                setIsEditing(false);
                setIsModalOpen(false);
            } else {
                console.error('Failed to update bid:', data.message);
            }
        } catch (error) {
            console.error('Error updating bid:', error);
        }
    };

    const handleNewEstimate = () => {
        window.location.href = `${aiebsData.siteUrl}/${aiebsData.dashboardSlug}?action=new_estimate`;
    };

    const toggleChartView = () => {
        setIsChartView(!isChartView);
    };

    return (
        <div className="ai-enabled-bidding-dashboard p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Your Bids</h2>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleNewEstimate}
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex items-center"
                    >
                        <FaPlus className="mr-2" /> New Estimate
                    </button>
                    <button
                        onClick={toggleChartView}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
                    >
                        <FaChartBar className="mr-2" /> {isChartView ? 'Table View' : 'Chart View'}
                    </button>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search bids..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-full"
                            style={{paddingLeft: '2.5rem'}}
                        />
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" style={{left: '0.75rem'}} />
                    </div>
                </div>
            </div>

            {isChartView ? (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={filteredBids}>
                        <XAxis dataKey="project_name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total_amount" fill="#8884d8" />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <table className="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-2">Project Name</th>
                            <th className="border border-gray-300 p-2">Description</th>
                            <th className="border border-gray-300 p-2">Time Frame</th>
                            <th className="border border-gray-300 p-2">Specially bidded for</th>
                            <th className="border border-gray-300 p-2">Status</th>
                            <th className="border border-gray-300 p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBids.map((bid) => (
                            <tr key={bid.id}>
                                <td className="border border-gray-300 p-2">{bid.project_name}</td>
                                <td className="border border-gray-300 p-2">{bid.description.substring(0, 50)}...</td>
                                <td className="border border-gray-300 p-2">{bid.timeframe}</td>
                                <td className="border border-gray-300 p-2">{bid.construction_field}</td>
                                <td className="border border-gray-300 p-2 text-center">
                                    <div className="flex items-center justify-center">
                                        {getStatusIcon(bid.status)}
                                        <select
                                            value={bid.status}
                                            onChange={(e) => handleStatusChange(bid.id, e.target.value)}
                                            className="ml-2 p-1 border rounded"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="approved">Approved</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </div>
                                </td>
                                <td className="border border-gray-300 p-2">
                                    <div className="flex justify-between">
                                        <button 
                                            onClick={() => handleBidClick(bid)}
                                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded mr-2"
                                        >
                                            View
                                        </button>
                                        <button 
                                            onClick={() => handleEditBid(bid)}
                                            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded mr-2"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteBid(bid.id)}
                                            className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <Modal
                isOpen={isModalOpen}
                onRequestClose={() => {
                    setIsModalOpen(false);
                    setIsEditing(false);
                    setSelectedBid(null);
                }}
                contentLabel="Bid Details"
                className="modal"
                overlayClassName="overlay"
                ariaHideApp={false}
            >
                {selectedBid && (
                    <div className="bg-white p-8 rounded-lg shadow-lg w-[800px] max-w-full mx-auto">
                        <h2 className="text-2xl font-bold mb-6">
                            {isEditing ? 'Edit Bid' : 'Bid Details'}
                        </h2>
                        {isEditing ? (
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleSaveBidEdit(selectedBid);
                            }}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Project Name</label>
                                        <input
                                            type="text"
                                            value={selectedBid.project_name}
                                            onChange={(e) => setSelectedBid({...selectedBid, project_name: e.target.value})}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Description</label>
                                        <textarea
                                            value={selectedBid.description}
                                            onChange={(e) => setSelectedBid({...selectedBid, description: e.target.value})}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                            rows="3"
                                        ></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Timeframe</label>
                                        <input
                                            type="text"
                                            value={selectedBid.timeframe}
                                            onChange={(e) => setSelectedBid({...selectedBid, timeframe: e.target.value})}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Line Items</label>
                                        {selectedBid.lineItems.map((item, index) => (
                                            <div key={index} className="flex space-x-2 mt-2">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => {
                                                        const newLineItems = [...selectedBid.lineItems];
                                                        newLineItems[index].name = e.target.value;
                                                        setSelectedBid({...selectedBid, lineItems: newLineItems});
                                                    }}
                                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                />
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => {
                                                        const newLineItems = [...selectedBid.lineItems];
                                                        newLineItems[index].price = parseFloat(e.target.value);
                                                        setSelectedBid({...selectedBid, lineItems: newLineItems});
                                                    }}
                                                    className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                />
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const newLineItems = [...selectedBid.lineItems];
                                                        newLineItems[index].quantity = parseInt(e.target.value);
                                                        setSelectedBid({...selectedBid, lineItems: newLineItems});
                                                    }}
                                                    className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={(e) => {
                                                        const newLineItems = [...selectedBid.lineItems];
                                                        newLineItems[index].unit = e.target.value;
                                                        setSelectedBid({...selectedBid, lineItems: newLineItems});
                                                    }}
                                                    className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newLineItems = selectedBid.lineItems.filter((_, i) => i !== index);
                                                        setSelectedBid({...selectedBid, lineItems: newLineItems});
                                                    }}
                                                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newLineItems = [...selectedBid.lineItems, { name: '', price: 0, quantity: 1, unit: '' }];
                                                setSelectedBid({...selectedBid, lineItems: newLineItems});
                                            }}
                                            className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                                        >
                                            Add Line Item
                                        </button>
                                    </div>
                                    <div>
                                    <h3 className="font-bold text-lg mt-4 mb-2">Line Items:</h3>
                                        {selectedBid.lineItems.map((item, index) => (
                                            <div key={index} className="flex space-x-2 mb-2">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => handleEditLineItem(index, 'name', e.target.value)}
                                                    className="flex-1 px-2 py-1 border rounded"
                                                    placeholder="Item name"
                                                />
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => handleEditLineItem(index, 'price', parseFloat(e.target.value))}
                                                    className="w-24 px-2 py-1 border rounded"
                                                    placeholder="Price"
                                                />
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleEditLineItem(index, 'quantity', parseInt(e.target.value))}
                                                    className="w-20 px-2 py-1 border rounded"
                                                    placeholder="Quantity"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={(e) => handleEditLineItem(index, 'unit', e.target.value)}
                                                    className="w-20 px-2 py-1 border rounded"
                                                    placeholder="Unit"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLineItem(index)}
                                                    className="bg-red-500 text-white px-2 py-1 rounded"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={handleAddLineItem}
                                            className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
                                        >
                                            Add Line Item
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end space-x-2">
                                    <button
                                        type="submit"
                                        className="bg-blue-500 text-white px-4 py-2 rounded"
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAIEdit}
                                        className="bg-purple-500 text-white px-4 py-2 rounded"
                                    >
                                        AI Edit Suggestions
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setSelectedBid(null);
                                            setIsModalOpen(false);
                                        }}
                                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <p><strong>Project Name:</strong> {selectedBid.project_name}</p>
                                <p><strong>Company Name:</strong> {selectedBid.company_name}</p>
                                <p><strong>Description:</strong> {selectedBid.description}</p>
                                <p><strong>Location:</strong> {selectedBid.location}</p>
                                <p><strong>Timeframe:</strong> {selectedBid.timeframe}</p>
                                <p><strong>Specially bidded for:</strong> {selectedBid.construction_field}</p>
                                <p><strong>Status:</strong> {selectedBid.status}</p>
                                <div>
                                    <h3 className="font-bold text-lg mt-4 mb-2">Line Items:</h3>
                                    <ul className="list-disc pl-5 space-y-2">
                                        {selectedBid.lineItems.map((item, index) => (
                                            <li key={index}>
                                                {item.name}: ${item.price.toFixed(2)} ({item.quantity} {item.unit})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="mt-4 flex justify-end space-x-2">
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                                    >
                                        Edit Bid
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            setSelectedBid(null);
                                        }}
                                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {isAIChatOpen && (
                <AIEditChatBox
                    bid={selectedBid}
                    onClose={() => setIsAIChatOpen(false)}
                    onUpdate={(updatedBid) => {
                        setSelectedBid(updatedBid);
                        setBids(bids.map(b => b.id === updatedBid.id ? updatedBid : b));
                    }}
                />
            )}
        </div>
    );
};

export default AIEnabledBiddingDashboard;