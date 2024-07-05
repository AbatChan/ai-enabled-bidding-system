import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { FaSearch, FaCircle } from 'react-icons/fa';

const AIEnabledBiddingDashboard = () => {
    const [bids, setBids] = useState([]);
    const [filteredBids, setFilteredBids] = useState([]);
    const [selectedBid, setSelectedBid] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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

    const handleBidClick = (bid) => {
        setSelectedBid(bid);
        setIsModalOpen(true);
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

    return document.getElementById('ai-enabled-bidding-dashboard') ? (
        <div className="ai-enabled-bidding-dashboard p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Your Bids</h2>
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
                                        View Details
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

            <Modal
                isOpen={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                contentLabel="Bid Details"
                className="modal"
                overlayClassName="overlay"
                ariaHideApp={false}
            >
                {selectedBid && (
                    <div className="bg-white p-8 rounded-lg shadow-lg w-[800px] max-w-full mx-auto">
                        <h2 className="text-2xl font-bold mb-6">Bid Details</h2>
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
                        </div>
                        <div className="mt-8 flex justify-end space-x-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-300 ease-in-out transform hover:-translate-y-1 shadow-md"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    ) : null;
};

export default AIEnabledBiddingDashboard;